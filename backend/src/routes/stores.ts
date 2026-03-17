import { FastifyInstance } from 'fastify';
import { Store, IStore } from '../models/Store';
import { Product } from '../models/Product';
import { z } from 'zod';

const createStoreSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string(),
  logo_url: z.string().optional(),
  banner_url: z.string().optional(),
});

export async function storeRoutes(fastify: FastifyInstance) {
  // List stores with filtering and pagination
  fastify.get('/', async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        category,
        status = 'active',
        search,
        limit = 20,
        skip = 0,
        sort = '-follower_count'
      } = query;

      const filter: any = {};
      if (category) filter.category = category;
      if (status) filter.status = status;

      if (search) {
        filter.name = { $regex: search, $options: 'i' };
      }

      const stores = await Store.find(filter)
        .sort(sort)
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .lean();

      const total = await Store.countDocuments(filter);

      return {
        data: stores,
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get store by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const store = await Store.findById(id).lean();

      if (!store) {
        return reply.code(404).send({ error: 'Store not found' });
      }

      // Get store products
      const products = await Product.find({ store_id: id, status: 'active' })
        .limit(20)
        .lean();

      return {
        ...store,
        products
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get store by owner email
  fastify.get('/owner/:email', async (request, reply) => {
    try {
      const { email } = request.params as { email: string };
      const store = await Store.findOne({ owner_email: email }).lean();

      // Return null (200 OK) instead of 404 if store doesn't exist
      // This is expected behavior - not all users have stores
      if (!store) {
        return reply.code(200).send(null);
      }

      return store;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Create store
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const body = createStoreSchema.parse(request.body);

      // Check if user already has a store
      const existingStore = await Store.findOne({ owner_email: user.email });
      if (existingStore) {
        return reply.code(400).send({ error: 'User already has a store' });
      }

      const store = new Store({
        ...body,
        owner_email: user.email,
        status: 'active', // In production, might be 'pending'
        created_at: new Date(),
        updated_at: new Date()
      });

      await store.save();
      return store;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update store
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Partial<IStore>;
      const user = request.user as any;

      const store = await Store.findById(id);
      if (!store) {
        return reply.code(404).send({ error: 'Store not found' });
      }

      if (store.owner_email !== user.email) {
        return reply.code(403).send({ error: 'Unauthorized' });
      }

      // Update allowed fields
      const allowedUpdates = ['name', 'description', 'logo_url', 'banner_url', 'category'];
      allowedUpdates.forEach(field => {
        if ((body as any)[field] !== undefined) {
          (store as any)[field] = (body as any)[field];
        }
      });

      store.updated_at = new Date();
      await store.save();

      return store;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}