import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { Store } from '../models/Store';
import { CartItem } from '../models/CartItem';
import { ShippingZone } from '../models/ShippingZone';
import { AffiliateLink } from '../models/AffiliateLink';
import { paystackService } from '../services/paystackService';
import { Coupon } from '../models/Coupon';

const checkoutSchema = z.object({
  items: z.array(z.object({
    product_id: z.string(),
    quantity: z.number().min(1),
  })).optional(), // Optional if we want to use current cart
  shipping_address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string().default('NG'),
    phone: z.string(),
  }),
  payment_method: z.enum(['card', 'mobile_money', 'bank_transfer', 'paystack']).default('paystack'),
  order_note: z.string().optional(),
  coupon_code: z.string().optional(),
  affiliate_ref: z.string().optional(),
  affiliate_time: z.string().optional(),
});

export async function checkoutRoutes(fastify: FastifyInstance) {
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = request.user as any;
      const body = checkoutSchema.parse(request.body);

      // 1. Get items (either from body or current cart)
      let cartItemsToProcess = [];
      if (body.items && body.items.length > 0) {
        // If items passed in body, we might still want to check for their affiliate_username in CartItem
        // or just use what's provided. For simplicity, let's look them up.
        for (const item of body.items) {
           const ci = await CartItem.findOne({ user_username: user.username, product_id: item.product_id });
           cartItemsToProcess.push({
             product_id: item.product_id,
             quantity: item.quantity,
             affiliate_username: ci?.affiliate_username
           });
        }
      } else {
        const cartItems = await CartItem.find({ user_username: user.username });
        if (cartItems.length === 0) {
          throw new Error('Cart is empty');
        }
        cartItemsToProcess = cartItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          affiliate_username: item.affiliate_username
        }));
      }

      // 2. Fetch all products and stores
      const productIds = cartItemsToProcess.map(i => i.product_id);
      const dbProducts = await Product.find({ _id: { $in: productIds }, status: 'active' });
      
      if (dbProducts.length !== new Set(productIds).size) {
        throw new Error('One or more products not found or inactive');
      }

      const productMap = new Map(dbProducts.map(p => [p._id.toString(), p]));
      const storeIds = Array.from(new Set(dbProducts.map(p => p.store_id.toString())));
      const dbStores = await Store.find({ _id: { $in: storeIds } });
      const storeMap = new Map(dbStores.map(s => [s._id.toString(), s]));

      // 3. Group items by store
      const storeGroups: Record<string, any[]> = {};
      for (const item of cartItemsToProcess) {
        const product = productMap.get(item.product_id)!;
        const storeId = product.store_id.toString();
        if (!storeGroups[storeId]) storeGroups[storeId] = [];
        storeGroups[storeId].push({
          ...item,
          product,
        });
      }

      // 4. Validate Coupon if provided
      let coupon = null;
      let totalSubtotalAcrossStores = 0; // Needed for proportional global flat coupons

      if (body.coupon_code) {
        coupon = await Coupon.findOne({ 
          code: body.coupon_code.toUpperCase(), 
          status: 'active',
          expires_at: { $gt: new Date() }
        });
        if (!coupon) {
          throw new Error('Invalid or expired coupon code');
        }
      }

      // 4.5 Pre-fetch Affiliate Link if global ref provided
      let globalAffLink = null;
      if (body.affiliate_ref) {
        const ATTRIBUTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
        const refTime = body.affiliate_time ? parseInt(body.affiliate_time) : Date.now();
        const isWithinWindow = (Date.now() - refTime) <= ATTRIBUTION_WINDOW_MS;
        
        if (isWithinWindow) {
          globalAffLink = await AffiliateLink.findOne({
            ref_code: body.affiliate_ref.toUpperCase(),
            status: 'active'
          });
        }
      }

      // Pre-calculate total subtotal if we have a global flat coupon
      if (coupon && !coupon.store_id && coupon.discount_type === 'flat') {
        for (const storeId in storeGroups) {
          const groupItems = storeGroups[storeId];
          totalSubtotalAcrossStores += groupItems.reduce((sum, gi) => sum + (gi.product.price * gi.quantity), 0);
        }
      }

      const orders: any[] = [];
      let totalAmount = 0;

      // 5. Create orders for each store
      for (const storeId in storeGroups) {
        const groupItems = storeGroups[storeId];
        const store = storeMap.get(storeId)!;
        
        let subtotal = 0;
        let affiliate_commission = 0;
        let affiliate_username: string | undefined = undefined;

        const orderItems = groupItems.map(gi => {
          const price = gi.product.price;
          subtotal += price * gi.quantity;
          
          // Affiliate logic per product
          let itemAffiliate = gi.affiliate_username;
          let itemCommissionPct = 0;

          // If global ref matches this product
          if (globalAffLink && globalAffLink.product_id.toString() === gi.product_id.toString()) {
            itemAffiliate = globalAffLink.influencer_username;
            itemCommissionPct = globalAffLink.commission_pct;
          }

          if (itemAffiliate) {
             affiliate_username = itemAffiliate; // Last one wins or we'd need multiple orders per store? Usually one influencer per product.
             // If we didn't get Pct from global link, we might need a default or look it up?
             // For now, let's assume if it came from cart, it might have a default or we'd need another lookup.
             // But the original orders.ts ONLY gave commission if it matched a ref_code.
             if (itemCommissionPct > 0) {
                affiliate_commission += (price * gi.quantity * itemCommissionPct) / 100;
             }
          }

          return {
            product_id: gi.product_id,
            product_title: gi.product.title,
            product_image: gi.product.images[0],
            quantity: gi.quantity,
            price: price,
          };
        });

        // Calculate Shipping for this store
        let shipping_fee = 0;
        const countryCode = body.shipping_address.country.toUpperCase();
        const zones = await ShippingZone.find({
          store_id: storeId,
          is_active: true,
          $or: [
            { countries: { $in: [countryCode, 'WORLD'] } },
            { countries: { $size: 0 } }
          ]
        }).sort({ countries: -1 });

        if (zones.length > 0) {
          const zone = zones[0];
          shipping_fee = zone.flat_rate;
          if (zone.free_above > 0 && subtotal >= zone.free_above) {
            shipping_fee = 0;
          }
        }

        // Apply coupon discount if applicable to this store/products
        let discount = 0;
        if (coupon) {
           if (coupon.store_id && coupon.store_id.toString() === storeId) {
             // Store specific coupon
             if (coupon.discount_type === 'percentage') {
               discount = (subtotal * coupon.discount_value) / 100;
             } else {
               discount = Math.min(coupon.discount_value, subtotal);
             }
           } else if (!coupon.store_id) {
             // Global coupon
             if (coupon.discount_type === 'percentage') {
               discount = (subtotal * coupon.discount_value) / 100;
             } else {
               // Proportional flat discount
               if (totalSubtotalAcrossStores > 0) {
                 const proportionalDiscount = (subtotal / totalSubtotalAcrossStores) * coupon.discount_value;
                 // Round to 2 decimal places to avoid floating point issues
                 discount = Math.min(Math.round(proportionalDiscount * 100) / 100, subtotal);
               } else {
                 // Should not happen if subtotal is positive
                 discount = Math.min(coupon.discount_value, subtotal);
               }
             }
           }
        }

        const orderTotal = subtotal + shipping_fee - discount;
        totalAmount += orderTotal;

        const order = new Order({
          buyer_username: user.username,
          buyer_name: user.display_name || user.full_name || user.username,
          buyer_email: user.email,
          buyer_phone: body.shipping_address.phone,
          vendor_username: store.owner_username, // Changed from store.vendor_username to owner_username based on Store model
          store_id: store._id,
          store_name: store.name,
          items: orderItems,
          subtotal,
          shipping_fee,
          discount_amount: discount,
          total: orderTotal,
          shipping_address: `${body.shipping_address.street}, ${body.shipping_address.city}, ${body.shipping_address.state} ${body.shipping_address.zip}, ${body.shipping_address.country}`,
          shipping_country: body.shipping_address.country,
          order_note: body.order_note,
          status: 'pending',
          payment_status: 'pending',
          payment_method: body.payment_method,
          affiliate_username,
          affiliate_commission,
          affiliate_ref: body.affiliate_ref,
          affiliate_time: body.affiliate_time,
        });

        // Inventory check and reduction
        for (const item of groupItems) {
          const updatedProduct = await Product.findOneAndUpdate(
            { 
              _id: item.product_id, 
              status: 'active',
              inventory_count: { $gte: item.quantity } 
            },
            {
              $inc: { 
                sales_count: item.quantity,
                inventory_count: -item.quantity
              }
            },
            { new: true, session }
          );

          if (!updatedProduct) {
            throw new Error(`Insufficient stock for product: ${item.product.title}`);
          }
        }

        await order.save({ session });
        orders.push(order);

        // Update Affiliate Link stats if used
        if (globalAffLink) {
           await AffiliateLink.findByIdAndUpdate(globalAffLink._id, {
             $inc: { 
               conversions: 1,
               total_commission_earned: affiliate_commission 
             }
           }, { session });
        }
      }

      // 5.5 Increment coupon usage count if used
      if (coupon) {
        await Coupon.findByIdAndUpdate(coupon._id, { $inc: { uses_count: 1 } }, { session });
      }

      // 6. Initialize Payment if Paystack
      let paymentData = null;
      if (['card', 'paystack', 'mobile_money'].includes(body.payment_method)) {
        const orderIds = orders.map(o => o._id.toString()).join(',');
        paymentData = await paystackService.initializeTransaction(
          user.email,
          totalAmount,
          orderIds,
          'NGN',
          body.payment_method === 'mobile_money' ? ['mobile_money'] : ['card'],
          body.shipping_address.phone
        );
      }

      // 7. Clear Cart
      await CartItem.deleteMany({ user_username: user.username }, { session });

      await session.commitTransaction();

      return {
        message: 'Checkout successful',
        orders: orders.map(o => o._id),
        total_amount: totalAmount,
        payment_url: paymentData?.data?.authorization_url,
        reference: paymentData?.data?.reference,
      };

    } catch (error: any) {
      await session.abortTransaction();
      fastify.log.error(error);
      return reply.code(400).send({ 
        error: 'Checkout failed', 
        message: error.message 
      });
    } finally {
      session.endSession();
    }
  });
}
