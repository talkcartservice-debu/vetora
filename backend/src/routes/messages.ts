import { FastifyInstance } from 'fastify';
import { Message, IMessage } from '../models/Message';
import { User } from '../models/User';
import { z } from 'zod';

const sendMessageSchema = z.object({
  conversation_id: z.string().optional(),
  recipient_username: z.string().min(1),
  content: z.string().min(1),
  message_type: z.enum(['text', 'image', 'product_share', 'order_update', 'offer']).default('text'),
  image_url: z.string().optional(),
  product_id: z.string().optional(),
  product_data: z.object({
    title: z.string(),
    price: z.number(),
    image: z.string().optional(),
  }).optional(),
  offer_amount: z.number().optional(),
  order_id: z.string().optional(),
});

export async function messageRoutes(fastify: FastifyInstance) {
  // List messages with filtering (for sender/receiver queries)
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const query = request.query as any;
      const { 
        sender_username, receiver_username,
        sort = '-created_date', limit = 200, skip = 0 
      } = query;

      // Build filter
      const filter: any = {};
      
      if (sender_username) filter.sender_username = sender_username;
      if (receiver_username) filter.receiver_username = receiver_username;
      
      // If none is provided, default to current user's messages
      if (!sender_username && !receiver_username) {
        filter.$or = [
          { sender_username: user.username },
          { receiver_username: user.username }
        ];
      }

      // Build sort object
      const sortObj: any = {};
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const messages = await Message.find(filter)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .lean();

      const total = await Message.countDocuments(filter);

      return {
        data: messages,
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

  // List conversations
  fastify.get('/conversations', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      
      // Aggregate to get unique conversations with last message
      const conversations = await Message.aggregate([
        {
          $match: {
            $or: [
              { sender_username: user.username },
              { receiver_username: user.username }
            ]
          }
        },
        {
          $sort: { created_at: -1 }
        },
        {
          $group: {
            _id: "$conversation_id",
            last_message_content: { $first: "$content" },
            last_message_at: { $first: "$created_at" },
            other_user_username: { 
              $first: {
                $cond: [{ $eq: ["$sender_username", user.username] }, "$receiver_username", "$sender_username"]
              }
            }
          }
        },
        {
          $sort: { last_message_at: -1 }
        }
      ]);

      // Populate other user's info
      const populatedConversations = await Promise.all(conversations.map(async (conv) => {
        const otherUser = await User.findOne({ username: conv.other_user_username }, 'display_name avatar_url username');
        return {
          ...conv,
          other_user_name: otherUser?.display_name || otherUser?.username,
          other_user_avatar: otherUser?.avatar_url,
          other_user_username: otherUser?.username
        };
      }));

      return populatedConversations;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get messages for conversation
  fastify.get('/:conversationId', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { conversationId } = request.params as { conversationId: string };
      const messages = await Message.find({ conversation_id: conversationId })
        .sort({ created_at: 1 })
        .lean();
      
      return messages;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Send message
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const body = sendMessageSchema.parse(request.body);
      
      // If no conversation_id, create one from both usernames
      const usernames = [user.username, body.recipient_username].sort();
      const conversationId = body.conversation_id || `chat_${usernames[0]}_${usernames[1]}`;

      const message = new Message({
        ...body,
        conversation_id: conversationId,
        sender_username: user.username,
        sender_name: user.display_name || user.full_name || user.username,
        receiver_username: body.recipient_username,
        created_at: new Date(),
        updated_at: new Date()
      });

      await message.save();
      
      // Emit real-time event via Socket.IO if available
      if (body.recipient_username) {
        fastify.io?.to(`user:${body.recipient_username}`).emit('new-message', message);
      }

      return message;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update message (e.g., mark as read)
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;
      const updateData = request.body as any;

      const message = await Message.findOneAndUpdate(
        { _id: id, receiver_username: user.username },
        { ...updateData, updated_at: new Date() },
        { new: true }
      );

      if (!message) {
        return reply.code(404).send({ error: 'Message not found or unauthorized' });
      }

      return message;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Mark message as read
  fastify.patch('/:id/read', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const message = await Message.findOneAndUpdate(
        { _id: id, receiver_username: user.username },
        { is_read: true, read_at: new Date(), updated_at: new Date() },
        { new: true }
      );

      if (!message) {
        return reply.code(404).send({ error: 'Message not found or unauthorized' });
      }

      return message;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Mark all messages in a conversation as read
  fastify.patch('/conversation/:conversationId/read', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { conversationId } = request.params as { conversationId: string };
      const user = request.user as any;

      await Message.updateMany(
        { conversation_id: conversationId, receiver_username: user.username, is_read: false },
        { is_read: true, read_at: new Date(), updated_at: new Date() }
      );

      return { success: true };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Delete message
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const result = await Message.deleteOne({
        _id: id,
        $or: [
          { sender_username: user.username },
          { receiver_username: user.username }
        ]
      });

      if (result.deletedCount === 0) {
        return reply.code(404).send({ error: 'Message not found or unauthorized' });
      }

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
