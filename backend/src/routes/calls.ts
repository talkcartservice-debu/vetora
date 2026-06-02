import { FastifyInstance } from 'fastify';
import { Call, ICall } from '../models/Call';
import { User } from '../models/User';
import { z } from 'zod';

const createCallSchema = z.object({
  conversation_id: z.string().optional(),
  callee_username: z.string().min(1),
  call_type: z.enum(['voice', 'video']).default('voice'),
});

const updateCallSchema = z.object({
  status: z.enum(['answered', 'rejected', 'ended', 'missed']).optional(),
  duration: z.number().min(0).optional(),
});

export async function callRoutes(fastify: FastifyInstance) {
  // Create/initiate a call
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const body = createCallSchema.parse(request.body);

      // Get caller's display_name from DB
      const caller = await User.findById(user.userId).select('display_name username');
      const callerDisplayName = caller?.display_name || user.username;

      const call = new Call({
        ...body,
        caller_username: user.username,
        caller_name: callerDisplayName,
      });

      await call.save();

      // Emit real-time event to callee
      fastify.io?.to(`user:${body.callee_username}`).emit('call:incoming', {
        call: call.toObject(),
      });

      return call;
    } catch (error: any) {
      fastify.log.error('Call creation error:', error);
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      return reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Get incoming calls for current user
  fastify.get('/incoming', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      
      const calls = await Call.find({
        callee_username: user.username,
        status: 'ringing',
        created_at: { $gt: new Date(Date.now() - 60000) }, // Last minute
      }).sort({ created_at: -1 }).limit(10);

      return calls;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Answer a call
  fastify.post('/:id/answer', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const call = await Call.findOne({ _id: id, callee_username: user.username });
      if (!call) {
        return reply.code(404).send({ error: 'Call not found or unauthorized' });
      }

      call.status = 'answered';
      call.started_at = new Date();
      await call.save();

      fastify.io?.to(`user:${call.caller_username}`).emit('call:answered', {
        call: call.toObject(),
      });

      return call;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Reject a call
  fastify.post('/:id/reject', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const call = await Call.findOne({ _id: id, callee_username: user.username, status: 'ringing' });
      if (!call) {
        return reply.code(404).send({ error: 'Call not found or unauthorized' });
      }

      call.status = 'rejected';
      call.ended_at = new Date();
      await call.save();

      fastify.io?.to(`user:${call.caller_username}`).emit('call:rejected', {
        call: call.toObject(),
      });

      return call;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // End a call
  fastify.post('/:id/end', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;
      const body = updateCallSchema.parse(request.body);

      const call = await Call.findOne({
        _id: id,
        $or: [
          { caller_username: user.username },
          { callee_username: user.username }
        ],
      });

      if (!call) {
        return reply.code(404).send({ error: 'Call not found or unauthorized' });
      }

      call.status = 'ended';
      call.ended_at = new Date();
      if (body.duration) {
        call.duration = body.duration;
      } else if (call.started_at) {
        call.duration = Math.floor((Date.now() - call.started_at.getTime()) / 1000);
      }
      await call.save();

      // Notify both parties
      fastify.io?.to(`user:${call.caller_username}`).emit('call:ended', {
        call: call.toObject(),
      });
      fastify.io?.to(`user:${call.callee_username}`).emit('call:ended', {
        call: call.toObject(),
      });

      return call;
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get call history
  fastify.get('/history', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const { limit = 50, skip = 0 } = request.query as any;

      const calls = await Call.find({
        $or: [
          { caller_username: user.username },
          { callee_username: user.username }
        ],
      }).sort({ created_at: -1 }).limit(parseInt(limit)).skip(parseInt(skip));

      const total = await Call.countDocuments({
        $or: [
          { caller_username: user.username },
          { callee_username: user.username }
        ],
      });

      return {
        calls,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > parseInt(skip) + parseInt(limit),
        },
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Mark missed calls
  fastify.post('/missed', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;

      const result = await Call.updateMany(
        { callee_username: user.username, status: 'ringing', created_at: { $lt: new Date(Date.now() - 60000) } },
        { status: 'missed', ended_at: new Date() }
      );

      return { success: true, count: result.modifiedCount };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });
}