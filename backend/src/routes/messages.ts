import { FastifyInstance } from 'fastify';
import { Message, IMessage } from '../models/Message';
import { User } from '../models/User';
import { z } from 'zod';

const sendMessageSchema = z.object({
  conversation_id: z.string().optional(),
  recipient_email: z.string().email(),
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
      const { sender_email, receiver_email, sort = '-created_date', limit = 200, skip = 0 } = query;

      // Build filter - if sender_email or receiver_email is provided, use them
      const filter: any = {};
      
      if (sender_email) {
        filter.sender_email = sender_email;
      }
      if (receiver_email) {
        filter.receiver_email = receiver_email;
      }
      
      // If neither is provided, default to current user's messages
      if (!sender_email && !receiver_email) {
        filter.$or = [
          { sender_email: user.email },
          { receiver_email: user.email }
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
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
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
              { sender_email: user.email },
              { receiver_email: user.email }
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
            other_user_email: { 
              $first: {
                $cond: [{ $eq: ["$sender_email", user.email] }, "$receiver_email", "$sender_email"]
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
        const otherUser = await User.findOne({ email: conv.other_user_email }, 'display_name avatar_url');
        return {
          ...conv,
          other_user_name: otherUser?.display_name,
          other_user_avatar: otherUser?.avatar_url
        };
      }));

      return populatedConversations;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
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
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Send message
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const body = sendMessageSchema.parse(request.body);
      
      // If no conversation_id, create one from both emails
      const emails = [user.email, body.recipient_email].sort();
      const conversationId = body.conversation_id || `chat_${emails[0]}_${emails[1]}`;

      const message = new Message({
        ...body,
        conversation_id: conversationId,
        sender_email: user.email,
        receiver_email: body.recipient_email,
        created_at: new Date(),
        updated_at: new Date()
      });

      await message.save();
      
      // Emit real-time event via Socket.IO if available
      fastify.io?.to(`user:${body.recipient_email}`).emit('new-message', message);

      return message;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}