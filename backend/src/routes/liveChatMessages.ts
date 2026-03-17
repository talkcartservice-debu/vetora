import { FastifyInstance } from 'fastify';
import { LiveChatMessage, ILiveChatMessage } from '../models/LiveChatMessage';
import { LiveSession } from '../models/LiveSession';

export async function liveChatMessageRoutes(fastify: FastifyInstance) {
  // Get messages for a live session
  fastify.get('/', async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        session_id,
        message_type,
        limit = 50,
        skip = 0
      } = query;

      if (!session_id) {
        return reply.code(400).send({ error: 'session_id is required' });
      }

      // Build filter object
      const filter: any = { session_id };

      if (message_type) filter.message_type = message_type;

      const messages = await LiveChatMessage
        .find(filter)
        .sort({ created_at: 1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const total = await LiveChatMessage.countDocuments(filter);

      reply.send({
        messages,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > parseInt(skip) + parseInt(limit)
        }
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Send a message to a live session
  fastify.post('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const body = request.body as Partial<ILiveChatMessage>;
      const user = request.user as any;

      // Validate required fields
      if (!body.session_id || !body.content) {
        return reply.code(400).send({ error: 'Missing required fields: session_id, content' });
      }

      // Check if the live session exists and is active
      const liveSession = await LiveSession.findById(body.session_id);
      if (!liveSession) {
        return reply.code(404).send({ error: 'Live session not found' });
      }

      if (liveSession.status !== 'active') {
        return reply.code(400).send({ error: 'Live session is not active' });
      }

      const message = new LiveChatMessage({
        session_id: body.session_id,
        user_email: user.email,
        user_name: user.name || user.email,
        content: body.content,
        message_type: body.message_type || 'chat',
        product_id: body.product_id,
        product_title: body.product_title,
      });

      await message.save();

      // Emit real-time event to all users in the session
      fastify.io?.to(`live-session-${body.session_id}`).emit('live-chat-message', {
        message: message.toObject(),
        session_id: body.session_id
      });

      reply.code(201).send(message);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Send system messages (join, purchase, like)
  fastify.post('/system', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const body = request.body as {
        session_id: string;
        message_type: 'join' | 'purchase' | 'like';
        content: string;
        product_id?: string;
        product_title?: string;
      };
      const user = request.user as any;

      const { session_id, message_type, content, product_id, product_title } = body;

      // Validate message type
      if (!['join', 'purchase', 'like'].includes(message_type)) {
        return reply.code(400).send({ error: 'Invalid message_type. Must be join, purchase, or like' });
      }

      // Check if the live session exists and is active
      const liveSession = await LiveSession.findById(session_id);
      if (!liveSession) {
        return reply.code(404).send({ error: 'Live session not found' });
      }

      if (liveSession.status !== 'active') {
        return reply.code(400).send({ error: 'Live session is not active' });
      }

      const message = new LiveChatMessage({
        session_id,
        user_email: user.email,
        user_name: user.name || user.email,
        content,
        message_type,
        product_id,
        product_title,
      });

      await message.save();

      // Emit real-time event
      fastify.io?.to(`live-session-${session_id}`).emit('live-chat-message', {
        message: message.toObject(),
        session_id
      });

      reply.code(201).send(message);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get message statistics for a session
  fastify.get('/stats/:sessionId', async (request, reply) => {
    try {
      const { sessionId } = request.params as { sessionId: string };

      const stats = await LiveChatMessage.aggregate([
        { $match: { session_id: sessionId } },
        {
          $group: {
            _id: '$message_type',
            count: { $sum: 1 }
          }
        }
      ]);

      const totalMessages = await LiveChatMessage.countDocuments({ session_id: sessionId });
      const uniqueUsers = await LiveChatMessage.distinct('user_email', { session_id: sessionId });

      reply.send({
        session_id: sessionId,
        total_messages: totalMessages,
        unique_users: uniqueUsers.length,
        message_types: stats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {} as Record<string, number>)
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete a message (admin/moderator only)
  fastify.delete('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const message = await LiveChatMessage.findById(id);

      if (!message) {
        return reply.code(404).send({ error: 'Message not found' });
      }

      // TODO: Add moderator check - for now only message author can delete
      if (message.user_email !== user.email) {
        return reply.code(403).send({ error: 'You can only delete your own messages' });
      }

      await LiveChatMessage.findByIdAndDelete(id);

      // Emit real-time event
      fastify.io?.to(`live-session-${message.session_id}`).emit('live-chat-message-deleted', {
        message_id: id,
        session_id: message.session_id
      });

      reply.send({ message: 'Message deleted successfully' });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });
}