import { FastifyInstance } from 'fastify';
import { Notification, INotification } from '../models/Notification';
import { z } from 'zod';

export async function notificationRoutes(fastify: FastifyInstance) {
  // List notifications for a user
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const { limit = 50, skip = 0, unread_only = 'false' } = request.query as any;

      const filter: any = { recipient_email: user.email };
      if (unread_only === 'true') {
        filter.is_read = false;
      }

      const notifications = await Notification.find(filter)
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .lean();

      const total = await Notification.countDocuments(filter);
      const unreadCount = await Notification.countDocuments({ recipient_email: user.email, is_read: false });

      return {
        data: notifications,
        total,
        unreadCount,
        limit: parseInt(limit),
        skip: parseInt(skip),
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Mark notification as read
  fastify.patch('/:id/read', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const notification = await Notification.findOneAndUpdate(
        { _id: id, recipient_email: user.email },
        { is_read: true },
        { new: true }
      );

      if (!notification) {
        return reply.code(404).send({ error: 'Notification not found' });
      }

      return notification;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Mark all notifications as read
  fastify.patch('/read-all', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;

      await Notification.updateMany(
        { recipient_email: user.email, is_read: false },
        { is_read: true }
      );

      return { status: 'success' };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete notification
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const result = await Notification.deleteOne({ _id: id, recipient_email: user.email });
      if (result.deletedCount === 0) {
        return reply.code(404).send({ error: 'Notification not found' });
      }

      return { status: 'deleted' };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}