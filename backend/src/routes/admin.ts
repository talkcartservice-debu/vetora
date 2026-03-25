import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { User } from '../models/User';
import { Store } from '../models/Store';
import { Withdrawal } from '../models/Withdrawal';
import { Order } from '../models/Order';
import { Settings } from '../models/Settings';
import { authenticate, isAdmin } from '../middleware/auth';

export async function adminRoutes(fastify: FastifyInstance) {
  // Add authentication and admin check to all routes in this plugin
  fastify.addHook('preHandler', async (request, reply) => {
    await authenticate(request, reply);
    await isAdmin(request, reply);
  });

  // --- User Management ---

  // Get all users
  fastify.get('/users', async (request, reply) => {
    try {
      const { page = 1, limit = 10, search = '' } = request.query as any;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const query: any = {};
      if (search) {
        query.$or = [
          { email: { $regex: search, $options: 'i' } },
          { display_name: { $regex: search, $options: 'i' } }
        ];
      }

      const users = await User.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await User.countDocuments(query);

      return {
        users,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Block/Unblock user
  fastify.patch('/users/:id/block', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { is_blocked } = z.object({ is_blocked: z.boolean() }).parse(request.body);

      const user = await User.findByIdAndUpdate(id, { is_blocked }, { new: true });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      return user;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Change user role
  fastify.patch('/users/:id/role', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { role } = z.object({ 
        role: z.enum(['user', 'vendor', 'super_admin']) 
      }).parse(request.body);

      const user = await User.findByIdAndUpdate(id, { role }, { new: true });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      return user;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // --- Store Management ---

  // Get all stores
  fastify.get('/stores', async (request, reply) => {
    try {
      const { page = 1, limit = 10, status, search = '' } = request.query as any;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const query: any = {};
      if (status) query.status = status;
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { owner_email: { $regex: search, $options: 'i' } }
        ];
      }

      const stores = await Store.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Store.countDocuments(query);

      return {
        stores,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update store status
  fastify.patch('/stores/:id/status', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { status } = z.object({ 
        status: z.enum(['active', 'pending', 'suspended']) 
      }).parse(request.body);

      const store = await Store.findByIdAndUpdate(id, { status }, { new: true });
      if (!store) {
        return reply.code(404).send({ error: 'Store not found' });
      }

      return store;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Verify store
  fastify.patch('/stores/:id/verify', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { is_verified } = z.object({ is_verified: z.boolean() }).parse(request.body);

      const store = await Store.findByIdAndUpdate(id, { is_verified }, { new: true });
      if (!store) {
        return reply.code(404).send({ error: 'Store not found' });
      }

      return store;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // --- Withdrawal Management ---

  // Get all withdrawals
  fastify.get('/withdrawals', async (request, reply) => {
    try {
      const { page = 1, limit = 10, status } = request.query as any;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const query: any = {};
      if (status) query.status = status;

      const withdrawals = await Withdrawal.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Withdrawal.countDocuments(query);

      return {
        withdrawals,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update withdrawal status
  fastify.patch('/withdrawals/:id/status', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { status, notes } = z.object({ 
        status: z.enum(['pending', 'processing', 'completed', 'rejected']),
        notes: z.string().optional()
      }).parse(request.body);

      const updateData: any = { status };
      if (notes) updateData.notes = notes;
      if (status === 'completed') updateData.processed_at = new Date();

      const withdrawal = await Withdrawal.findByIdAndUpdate(id, updateData, { new: true });
      if (!withdrawal) {
        return reply.code(404).send({ error: 'Withdrawal request not found' });
      }

      return withdrawal;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // --- Order Management ---

  // Get all orders
  fastify.get('/orders', async (request, reply) => {
    try {
      const { page = 1, limit = 10, status, search = '' } = request.query as any;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const query: any = {};
      if (status) query.status = status;
      if (search) {
        query.$or = [
          { buyer_email: { $regex: search, $options: 'i' } },
          { vendor_email: { $regex: search, $options: 'i' } },
          { store_name: { $regex: search, $options: 'i' } }
        ];
      }

      const orders = await Order.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Order.countDocuments(query);

      return {
        orders,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // --- System Statistics ---

  fastify.get('/stats', async (request, reply) => {
    try {
      const [
        totalUsers,
        totalStores,
        activeStores,
        pendingStores,
        totalOrders,
        totalWithdrawals,
        pendingWithdrawals,
        settings
      ] = await Promise.all([
        User.countDocuments(),
        Store.countDocuments(),
        Store.countDocuments({ status: 'active' }),
        Store.countDocuments({ status: 'pending' }),
        Order.countDocuments(),
        Withdrawal.countDocuments(),
        Withdrawal.countDocuments({ status: 'pending' }),
        Settings.findOne()
      ]);

      // Calculate total sales from all orders
      const salesResult = await Order.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]);
      const totalSales = salesResult.length > 0 ? salesResult[0].total : 0;

      // Recent users
      const recentUsers = await User.find().sort({ created_at: -1 }).limit(5);
      
      // Recent stores
      const recentStores = await Store.find().sort({ created_at: -1 }).limit(5);

      return {
        counts: {
          users: totalUsers,
          stores: {
            total: totalStores,
            active: activeStores,
            pending: pendingStores
          },
          orders: totalOrders,
          withdrawals: {
            total: totalWithdrawals,
            pending: pendingWithdrawals
          },
          total_sales: totalSales
        },
        recent: {
          users: recentUsers,
          stores: recentStores
        },
        settings: settings || { maintenance_mode: false, maintenance_message: '' }
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // --- System Settings ---

  // Update system settings
  fastify.patch('/settings', async (request, reply) => {
    try {
      const { maintenance_mode, maintenance_message } = z.object({
        maintenance_mode: z.boolean().optional(),
        maintenance_message: z.string().optional()
      }).parse(request.body);

      let settings = await Settings.findOne();
      if (!settings) {
        settings = new Settings();
      }

      if (maintenance_mode !== undefined) settings.maintenance_mode = maintenance_mode;
      if (maintenance_message !== undefined) settings.maintenance_message = maintenance_message;

      await settings.save();
      return settings;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}