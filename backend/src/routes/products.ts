import { FastifyInstance } from 'fastify';
import { Product, IProduct } from '../models/Product';
import { User } from '../models/User';
import { Like } from '../models/Like';
import { WishlistItem } from '../models/WishlistItem';
import { Order } from '../models/Order';
import { Follow } from '../models/Follow';
import { Notification } from '../models/Notification';
import { Store } from '../models/Store';
import { NotificationService } from '../services/notificationService';
import { checkProductCountLimit, checkProductMediaLimit, checkAdvancedAnalyticsLimit, checkAffiliateLimit } from '../middleware/subscription';

export async function productRoutes(fastify: FastifyInstance) {
  // Get recommended products for the current user
  fastify.get('/recommendations', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const { limit = 10 } = request.query as any;

      if (!user?.username) {
        return reply.code(401).send({ error: 'Unauthorized - invalid user data' });
      }

      const [likes, wishlist, orders] = await Promise.all([
        Like.find({ user_username: user.username, target_type: 'product' }).select('target_id'),
        WishlistItem.find({ user_username: user.username }).select('product_id'),
        Order.find({ buyer_username: user.username }).select('items.product_id')
      ]);

      const likedIds = likes.map(l => l.target_id);
      const wishlistIds = wishlist.map(w => w.product_id);
      const purchasedIds = orders.flatMap(o => o.items.map(i => i.product_id));

      // 2. Combine all interacted IDs to exclude them from "fresh" recommendations if needed
      // or use them to find similar products.
      const allInteractedIds = [...new Set([...likedIds, ...wishlistIds, ...purchasedIds])];

      // 3. Simple recommendation logic:
      // - Get products that are top-selling and NOT already purchased
      // - If we have liked/wishlisted products, we could find more from those categories (TBD)
      
      const recommendations = await Product.find({
        status: 'active',
        _id: { $nin: purchasedIds } // Exclude already bought products
      })
      .sort({ sales_count: -1, created_at: -1 })
      .limit(parseInt(limit))
      .lean({ virtuals: true });

      // 4. Boost logic: if a product is in wishlist or liked, it should probably be higher
      // but here we already have them. The client side was doing scoring.
      // For a "Recommended for you" we usually want NEW things.
      
      return { data: recommendations };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // List products with filtering, sorting, and pagination
  fastify.get('/', async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        category,
        status = 'active',
        vendor_username,
        vendor_plan,
        store_id,
        search,
        sort = '-sales_count',
        limit = 50,
        skip = 0
      } = query;

      // Build filter object
      const filter: any = {};

      if (status) filter.status = status;
      if (category) filter.category = category;
      if (vendor_username) filter.vendor_username = vendor_username;
      if (vendor_plan) filter.vendor_plan = vendor_plan;
      if (store_id) filter.store_id = store_id;

      // Text search
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } }
        ];
      }

      // Build sort object
      const sortObj: any = { plan_priority: -1 };
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const products = await Product
        .find(filter)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .lean({ virtuals: true });

      const total = await Product.countDocuments(filter);

      return {
        data: products,
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get product by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const product = await Product.findById(id).lean({ virtuals: true });

      if (!product) {
        return reply.code(404).send({ error: 'Product not found' });
      }

      return product;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Create product
  fastify.post('/', {
    preHandler: [fastify.authenticate, checkProductCountLimit, checkProductMediaLimit, checkAffiliateLimit],
  }, async (request, reply) => {
    try {
      const productData = request.body as Partial<IProduct>;
      const user = request.user as any;

      if (!user?.username) {
        return reply.code(401).send({ error: 'Invalid user session' });
      }

      const product = new Product({
        ...productData,
        vendor_username: user.username,
        vendor_plan: (request as any).vendor_plan || 'free',
        plan_priority: (request as any).vendor_priority || 0,
      });

      const savedProduct = await product.save();

      // Emit real-time event
      fastify.io?.emit('product:created', savedProduct);

      // Notification logic for followers in background
      (async () => {
        try {
          const vendorName = user.display_name || user.username;
          let storeName = '';
          
          if (savedProduct.store_id) {
            const store = await Store.findById(savedProduct.store_id);
            if (store) storeName = store.name;
          }

          // Find unique followers of the vendor (user follow) or the store (store follow)
          const followers = await Follow.find({
            $or: [
              { following_username: user.username, follow_type: 'user' },
              ...(savedProduct.store_id ? [{ target_id: savedProduct.store_id.toString(), follow_type: 'store' }] : [])
            ]
          }).select('follower_username');

          const uniqueFollowerUsernames = [...new Set(followers.map(f => f.follower_username))];

          // Exclude the vendor themselves if they somehow follow themselves
          const recipientUsernames = uniqueFollowerUsernames.filter(username => username !== user.username);

          if (recipientUsernames.length > 0) {
            const title = storeName 
              ? `${storeName} added a new product: ${savedProduct.title}`
              : `${vendorName} added a new product: ${savedProduct.title}`;
            
            const body = savedProduct.description 
              ? (savedProduct.description.length > 100 ? savedProduct.description.substring(0, 97) + '...' : savedProduct.description)
              : `Check out our latest addition: ${savedProduct.title}`;

            const notifications = recipientUsernames.map(followerUsername => ({
              recipient_username: followerUsername,
              type: 'product_added',
              title,
              body,
              link: `/product/${savedProduct._id}`,
              sender_username: user.username,
              sender_name: vendorName,
              metadata: {
                product_id: savedProduct._id,
                store_id: savedProduct.store_id
              }
            }));

            const savedNotifications = await Notification.insertMany(notifications);
            
            // Emit via socket to each follower
            const io = fastify.io;
            if (io) {
              savedNotifications.forEach(notif => {
                io.to(`user:${notif.recipient_username}`).emit('notification:new', notif);
              });
            }

            // Send push notifications (native)
            await NotificationService.sendBulkPushNotifications(recipientUsernames, {
              title,
              body,
              type: 'product_added',
              metadata: { product_id: savedProduct._id }
            }, fastify);
          }
        } catch (error) {
          fastify.log.error(error, 'Error creating product added notifications');
        }
      })();

      return reply.code(201).send(savedProduct);
    } catch (error: any) {
      fastify.log.error(error);
      
      // Handle Mongoose validation errors
      if (error.name === 'ValidationError') {
        const details = Object.entries(error.errors).map(([path, e]: [string, any]) => ({
          path: [path],
          message: e.message
        }));
        return reply.code(400).send({ 
          error: 'Validation Error', 
          details 
        });
      }

      return reply.code(500).send({ error: 'Internal server error', message: error.message });
    }
  });

  // Update product
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate, checkProductMediaLimit, checkAffiliateLimit],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { vendor_plan, plan_priority, vendor_username, store_id, _id, ...safeUpdate } = request.body as Partial<IProduct>;
      const user = request.user as any;

      if (!user?.username) {
        return reply.code(401).send({ error: 'Unauthorized - invalid user data' });
      }

      const product = await Product.findOneAndUpdate(
        { _id: id, vendor_username: user.username },
        { ...safeUpdate, updated_at: new Date() },
        { new: true }
      );

      if (!product) {
        return reply.code(404).send({ error: 'Product not found or access denied' });
      }

      // Emit real-time event
      fastify.io?.emit('product:updated', product);

      return product;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Delete product
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      if (!user?.username) {
        return reply.code(401).send({ error: 'Unauthorized - invalid user data' });
      }

      const product = await Product.findOneAndDelete({
        _id: id,
        vendor_username: user.username
      });

      if (!product) {
        return reply.code(404).send({ error: 'Product not found or access denied' });
      }

      // Emit real-time event
      fastify.io?.emit('product:deleted', { id });

      return { success: true };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Track product view
  fastify.post('/:id/view', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await Product.findByIdAndUpdate(id, { $inc: { views_count: 1 } });
      return { success: true };
    } catch (error) {
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Track product click
  fastify.post('/:id/click', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await Product.findByIdAndUpdate(id, { $inc: { clicks_count: 1 } });
      return { success: true };
    } catch (error) {
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Track add to cart
  fastify.post('/:id/add-to-cart', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await Product.findByIdAndUpdate(id, { $inc: { add_to_cart_count: 1 } });
      return { success: true };
    } catch (error) {
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Track checkout start
  fastify.post('/:id/checkout-start', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await Product.findByIdAndUpdate(id, { $inc: { checkout_start_count: 1 } });
      return { success: true };
    } catch (error) {
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get product statistics (Advanced Analytics)
  fastify.get('/stats', {
    preHandler: [fastify.authenticate, checkAdvancedAnalyticsLimit],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const { store_id } = request.query as any;

      const filter: any = { vendor_username: user.username };
      if (store_id) filter.store_id = store_id;

      const products = await Product.find(filter)
        .select('title views_count clicks_count add_to_cart_count checkout_start_count sales_count price')
        .lean();

      const totalStats = products.reduce((acc, p) => {
        acc.views += (p.views_count || 0);
        acc.clicks += (p.clicks_count || 0);
        acc.add_to_cart += (p.add_to_cart_count || 0);
        acc.sales += (p.sales_count || 0);
        acc.revenue += ((p.sales_count || 0) * (p.price || 0));
        return acc;
      }, { views: 0, clicks: 0, add_to_cart: 0, sales: 0, revenue: 0 });

      return {
        summary: totalStats,
        products: products.map(p => ({
          ...p,
          ctr: p.views_count ? ((p.clicks_count / p.views_count) * 100).toFixed(2) : 0,
          conversion_rate: p.clicks_count ? ((p.sales_count / p.clicks_count) * 100).toFixed(2) : 0
        }))
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
