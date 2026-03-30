import { FastifyInstance } from 'fastify';
import { Order, IOrder } from '../models/Order';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { z } from 'zod';
import mongoose from 'mongoose';

const createOrderSchema = z.object({
  buyer_username: z.string().min(1).optional(),
  buyer_name: z.string().optional(),
  vendor_username: z.string().optional(),
  store_id: z.string().optional(),
  store_name: z.string().optional(),
  items: z.array(z.object({
    product_id: z.string(),
    product_title: z.string(),
    product_image: z.string().optional(),
    quantity: z.number().min(1),
    price: z.number().min(0),
  })),
  subtotal: z.number().min(0),
  shipping_fee: z.number().default(0),
  total: z.number().min(0),
  shipping_address: z.string().optional(),
  order_note: z.string().optional(),
  affiliate_username: z.string().min(1).or(z.literal('')).optional(),
  payment_method: z.enum(['card', 'paypal', 'crypto', 'bank_transfer', 'paystack']).default('paystack'),
});

export async function orderRoutes(fastify: FastifyInstance) {
  // List orders for a user
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const { role = 'buyer', status, limit = 20, skip = 0 } = request.query as any;

      const allowedStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
      if (status && !allowedStatuses.includes(status)) {
        return reply.code(400).send({ error: 'Invalid status value' });
      }

      const parsedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
      const parsedSkip = Math.max(parseInt(skip) || 0, 0);

      const filter: any = {};
      if (role === 'buyer') {
        filter.buyer_username = user.username;
      } else {
        filter.vendor_username = user.username;
      }

      if (status) filter.status = status;

      const orders = await Order.find(filter)
        .sort({ created_at: -1 })
        .limit(parsedLimit)
        .skip(parsedSkip)
        .lean();

      const total = await Order.countDocuments(filter);

      return {
        data: orders,
        total,
        limit: parsedLimit,
        skip: parsedSkip,
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get order by ID
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      if (!mongoose.isValidObjectId(id)) {
        return reply.code(400).send({ error: 'Invalid order ID' });
      }

      const order = await Order.findById(id).lean();

      if (!order) {
        return reply.code(404).send({ error: 'Order not found' });
      }

      // Check permissions
      if (order.buyer_username !== user.username && order.vendor_username !== user.username) {
        return reply.code(403).send({ error: 'Unauthorized' });
      }

      return order;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Create order
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const body = createOrderSchema.parse(request.body);

      // Get vendor and store details from the first product
      if (!body.items || body.items.length === 0) {
        return reply.code(400).send({ error: 'Order must contain at least one item' });
      }

      // Validate all product IDs
      for (const item of body.items) {
        if (!mongoose.isValidObjectId(item.product_id)) {
          return reply.code(400).send({ error: `Invalid product ID format: ${item.product_id}` });
        }
      }

      // Fetch all products from DB to get authoritative prices and vendor info
      const productIds = body.items.map(i => i.product_id);
      const uniqueProductIds = Array.from(new Set(productIds));
      const dbProducts = await Product.find({ _id: { $in: uniqueProductIds }, status: 'active' });

      if (dbProducts.length !== uniqueProductIds.length) {
        return reply.code(400).send({ error: 'One or more products not found or inactive' });
      }

      const productMap = new Map(dbProducts.map(p => [p._id.toString(), p]));
      const firstProduct = productMap.get(body.items[0].product_id)!;

      // Aggregate items for inventory check (if same product added twice)
      const inventoryChecks = new Map<string, number>();
      body.items.forEach(item => {
        const current = inventoryChecks.get(item.product_id) || 0;
        inventoryChecks.set(item.product_id, current + item.quantity);
      });

      // Recalculate subtotal and total server-side
      let computedSubtotal = 0;
      const validatedItems = body.items.map(item => {
        const dbProduct = productMap.get(item.product_id)!;
        const price = dbProduct.price;
        computedSubtotal += price * item.quantity;
        return {
          ...item,
          price, // Use DB price
          product_title: dbProduct.title, // Use DB title
          product_image: dbProduct.images[0], // Use DB image
        };
      });

      const shipping_fee = body.shipping_fee || 0;
      const computedTotal = computedSubtotal + shipping_fee;

      // Use a session for atomicity
      const session = await mongoose.startSession();
      try {
        let order;
        await session.withTransaction(async () => {
          // Update product sales count and inventory BEFORE saving order
          for (const [productId, quantity] of inventoryChecks.entries()) {
            const updatedProduct = await Product.findOneAndUpdate(
              { 
                _id: productId, 
                status: 'active',
                inventory_count: { $gte: quantity } 
              },
              {
                $inc: { 
                  sales_count: quantity,
                  inventory_count: -quantity
                }
              },
              { new: true, session }
            );

            if (!updatedProduct) {
              throw new Error(`Insufficient stock for product: ${productId}`);
            }
          }

          order = new Order({
            ...body,
            items: validatedItems,
            subtotal: computedSubtotal,
            total: computedTotal,
            buyer_username: user.username,
            vendor_username: firstProduct.vendor_username,
            store_id: firstProduct.store_id,
            store_name: firstProduct.store_name,
            order_note: body.order_note,
            affiliate_username: body.affiliate_username || undefined,
            status: 'pending',
            payment_status: 'pending',
            created_at: new Date(),
            updated_at: new Date()
          });

          await order.save({ session });
        });

        return order;
      } finally {
        await session.endSession();
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong while creating your order'
      });
    }
  });

  // Update order status
  fastify.patch('/:id/status', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { status } = z.object({
        status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'])
      }).parse(request.body);
      const user = request.user as any;

      if (!mongoose.isValidObjectId(id)) {
        return reply.code(400).send({ error: 'Invalid order ID' });
      }

      const order = await Order.findById(id);
      if (!order) {
        return reply.code(404).send({ error: 'Order not found' });
      }

      const isVendor = order.vendor_username === user.username;
      const isBuyer = order.buyer_username === user.username;

      if (!isVendor && !isBuyer) {
        return reply.code(403).send({ error: 'Unauthorized' });
      }

      // Only vendor can update status to fulfillment states
      if (!isVendor && ['confirmed', 'processing', 'shipped', 'delivered', 'refunded'].includes(status)) {
        return reply.code(403).send({ error: 'Unauthorized: Only vendors can update order fulfillment status' });
      }

      // Only buyer can update status to cancelled if it's still pending
      if (isBuyer && !isVendor && status === 'cancelled' && order.status !== 'pending') {
        return reply.code(400).send({ error: 'Cannot cancel order after it has been confirmed' });
      }

      // If user is just a buyer, they can only cancel
      if (isBuyer && !isVendor && status !== 'cancelled') {
        return reply.code(403).send({ error: 'Unauthorized: Buyers can only cancel orders' });
      }

      order.status = status as any;
      order.updated_at = new Date();
      await order.save();

      return order;
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });
}