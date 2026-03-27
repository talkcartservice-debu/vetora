import { FastifyInstance } from 'fastify';
import { Product, IProduct } from '../models/Product';
import { User } from '../models/User';
import { Like } from '../models/Like';
import { WishlistItem } from '../models/WishlistItem';
import { Order } from '../models/Order';

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
        Order.find({ $or: [{ buyer_email: user.email }, { buyer_username: user.username }] }).select('items.product_id')
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
      .lean();

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
      const sortObj: any = {};
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
        .lean();

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
      const product = await Product.findById(id).lean();

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
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const productData = request.body as Partial<IProduct>;
      const user = request.user as any;

      if (!user?.username) {
        return reply.code(401).send({ error: 'Invalid user session' });
      }

      const product = new Product({
        ...productData,
        vendor_email: user.email,
        vendor_username: user.username,
      });

      const savedProduct = await product.save();

      // Emit real-time event
      fastify.io?.emit('product:created', savedProduct);

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
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const updateData = request.body as Partial<IProduct>;
      const user = request.user as any;

      if (!user?.username) {
        return reply.code(401).send({ error: 'Unauthorized - invalid user data' });
      }

      const product = await Product.findOneAndUpdate(
        { _id: id, vendor_username: user.username },
        { ...updateData, updated_at: new Date() },
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
}