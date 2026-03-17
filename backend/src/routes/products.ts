import { FastifyInstance } from 'fastify';
import { Product, IProduct } from '../models/Product';
import { User } from '../models/User';

export async function productRoutes(fastify: FastifyInstance) {
  // List products with filtering, sorting, and pagination
  fastify.get('/', async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        category,
        status = 'active',
        vendor_email,
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
      if (vendor_email) filter.vendor_email = vendor_email;
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
        .lean({ virtuals: true });

      const total = await Product.countDocuments(filter);

      return {
        data: products,
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
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
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Create product
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const productData = request.body as Partial<IProduct>;
      const { userId } = request.user as { userId: string };

      // Get user to set vendor_email
      const user = await User.findById(userId);
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const product = new Product({
        ...productData,
        vendor_email: user.email,
      });

      const savedProduct = await product.save();

      // Emit real-time event
      fastify.io?.emit('product:created', savedProduct);

      return reply.code(201).send(savedProduct);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update product
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const updateData = request.body as Partial<IProduct>;
      const { userId } = request.user as { userId: string };

      // Get user to verify ownership
      const user = await User.findById(userId);
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const product = await Product.findOneAndUpdate(
        { _id: id, vendor_email: user.email },
        { ...updateData, updated_at: new Date() },
        { new: true }
      );

      if (!product) {
        return reply.code(404).send({ error: 'Product not found or access denied' });
      }

      // Emit real-time event
      fastify.io?.emit('product:updated', product);

      return product;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete product
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { userId } = request.user as { userId: string };

      // Get user to verify ownership
      const user = await User.findById(userId);
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const product = await Product.findOneAndDelete({
        _id: id,
        vendor_email: user.email
      });

      if (!product) {
        return reply.code(404).send({ error: 'Product not found or access denied' });
      }

      // Emit real-time event
      fastify.io?.emit('product:deleted', { id });

      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}