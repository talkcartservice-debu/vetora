import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { User } from '../models/User';
import { Store } from '../models/Store';
import { Withdrawal } from '../models/Withdrawal';
import { Order } from '../models/Order';
import { Settings } from '../models/Settings';
import { Report } from '../models/Report';
import { ActivityLog } from '../models/ActivityLog';
import { authenticate, isAdmin, logActivity } from '../middleware/auth';

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

      await logActivity(request, is_blocked ? 'block_user' : 'unblock_user', user._id, 'user');

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

      const oldUser = await User.findById(id);
      const user = await User.findByIdAndUpdate(id, { role }, { new: true });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      await logActivity(request, 'change_user_role', user._id, 'user', { 
        old_role: oldUser?.role, 
        new_role: role 
      });

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
          { owner_username: { $regex: search, $options: 'i' } }
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

      await logActivity(request, 'update_store_status', store._id, 'store', { status });

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

      await logActivity(request, is_verified ? 'verify_store' : 'unverify_store', store._id, 'store');

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

      await logActivity(request, 'update_withdrawal_status', withdrawal._id, 'withdrawal', { status });

      return withdrawal;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // --- Moderation (Reports) ---

  // Get all reports
  fastify.get('/reports', async (request, reply) => {
    try {
      const { page = 1, limit = 10, status } = request.query as any;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const query: any = {};
      if (status) query.status = status;

      const reports = await Report.find(query)
        .populate('reporter_id', 'display_name email')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Report.countDocuments(query);

      return {
        reports,
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

  // Resolve report
  fastify.patch('/reports/:id/resolve', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { status, admin_notes } = z.object({
        status: z.enum(['resolved', 'dismissed']),
        admin_notes: z.string().optional()
      }).parse(request.body);

      const user = request.user as any;
      const report = await Report.findByIdAndUpdate(id, {
        status,
        admin_notes,
        resolved_at: new Date(),
        resolved_by: user._id
      }, { new: true });

      if (!report) {
        return reply.code(404).send({ error: 'Report not found' });
      }

      await logActivity(request, 'resolve_report', report._id, 'report', { status });

      return report;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // --- Activity Logs ---

  // Get activity logs
  fastify.get('/activity-logs', async (request, reply) => {
    try {
      const { page = 1, limit = 20 } = request.query as any;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const logs = await ActivityLog.find()
        .populate('user_id', 'display_name email')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await ActivityLog.countDocuments();

      return {
        logs,
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
          { buyer_username: { $regex: search, $options: 'i' } },
          { vendor_username: { $regex: search, $options: 'i' } },
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
        totalReports,
        pendingReports,
        settings
      ] = await Promise.all([
        User.countDocuments(),
        Store.countDocuments(),
        Store.countDocuments({ status: 'active' }),
        Store.countDocuments({ status: 'pending' }),
        Order.countDocuments(),
        Withdrawal.countDocuments(),
        Withdrawal.countDocuments({ status: 'pending' }),
        Report.countDocuments(),
        Report.countDocuments({ status: 'pending' }),
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

      // Recent activity
      const recentActivity = await ActivityLog.find()
        .populate('user_id', 'display_name')
        .sort({ created_at: -1 })
        .limit(10);

      // Sales chart data (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const salesChart = await Order.aggregate([
        { $match: { 
          status: { $ne: 'cancelled' },
          created_at: { $gte: sevenDaysAgo }
        }},
        { $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
          total: { $sum: "$total" }
        }},
        { $sort: { "_id": 1 } }
      ]);

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
          reports: {
            total: totalReports,
            pending: pendingReports
          },
          total_sales: totalSales
        },
        recent: {
          users: recentUsers,
          stores: recentStores,
          activity: recentActivity
        },
        charts: {
          sales: salesChart
        },
        settings: settings || { 
          maintenance_mode: false, 
          maintenance_message: '',
          allow_registration: true,
          min_withdrawal_amount: 10,
          platform_fee_percent: 5
        }
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
      const { 
        maintenance_mode, 
        maintenance_message,
        allow_registration,
        min_withdrawal_amount,
        platform_fee_percent
      } = z.object({
        maintenance_mode: z.boolean().optional(),
        maintenance_message: z.string().optional(),
        allow_registration: z.boolean().optional(),
        min_withdrawal_amount: z.number().optional(),
        platform_fee_percent: z.number().optional()
      }).parse(request.body);

      let settings = await Settings.findOne();
      if (!settings) {
        settings = new Settings();
      }

      const oldSettings = JSON.parse(JSON.stringify(settings));

      if (maintenance_mode !== undefined) settings.maintenance_mode = maintenance_mode;
      if (maintenance_message !== undefined) settings.maintenance_message = maintenance_message;
      if (allow_registration !== undefined) settings.allow_registration = allow_registration;
      if (min_withdrawal_amount !== undefined) settings.min_withdrawal_amount = min_withdrawal_amount;
      if (platform_fee_percent !== undefined) settings.platform_fee_percent = platform_fee_percent;

      await settings.save();
      
      await logActivity(request, 'update_system_settings', settings._id, 'settings', {
        changed_fields: Object.keys(request.body as any)
      });

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
