import { FastifyInstance } from 'fastify';
import { Like } from '../models/Like';
import { likeTarget, unlikeTarget } from '../services/likeService';

export async function likeRoutes(fastify: FastifyInstance) {
  // Get likes for a specific target
  fastify.get('', async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        target_type,
        target_id,
        user_username,
        limit = 50,
        skip = 0
      } = query;

      // Build filter object
      const filter: any = {};

      if (target_type) filter.target_type = target_type;
      if (target_id) filter.target_id = target_id;
      if (user_username) filter.user_username = user_username.toLowerCase();

      const likes = await Like
        .find(filter)
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .lean({ virtuals: true });

      const total = await Like.countDocuments(filter);

      reply.send({
        data: likes,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > parseInt(skip) + parseInt(limit)
        }
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Check if user has liked a specific target
  fastify.get('/check', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { target_type, target_id } = query;
      const user = request.user as any;

      if (!target_type || !target_id) {
        return reply.code(400).send({ error: 'Missing required parameters: target_type, target_id' });
      }

      const like = await Like.findOne({
        user_username: user.username.toLowerCase(),
        target_type,
        target_id
      });

      reply.send({ has_liked: !!like });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Like a target
  fastify.post('', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const body = request.body as { target_type: string; target_id: string };
      const user = request.user as any;
      const { target_type, target_id } = body;

      const result = await likeTarget(user.username, target_type, target_id);

      // Emit generic real-time event
      fastify.io?.emit('like:created', {
        like: result.like_doc,
        target_type,
        target_id,
        user_username: user.username
      });

      // Special handling for entity-specific listeners
      switch (target_type) {
        case 'post':
          fastify.io?.emit('post_updated', {
            type: 'like',
            post_id: target_id,
            likes_count: result.likes_count,
            user_username: user.username
          });
          break;
        case 'story':
          fastify.io?.emit('story_updated', {
            type: 'like',
            story_id: target_id,
            likes_count: result.likes_count,
            user_username: user.username
          });
          break;
        case 'comment':
          fastify.io?.emit('comment_updated', {
            type: 'like',
            comment_id: target_id,
            likes_count: result.likes_count,
            user_username: user.username
          });
          break;
        case 'live_session':
          fastify.io?.to(`live-session-${target_id}`).emit('live-session-liked', {
            session_id: target_id,
            likes: result.likes_count
          });
          break;
      }

      reply.code(201).send(result);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return reply.code(404).send({ error: error.message });
      }
      if (error.message.includes('Already liked')) {
        return reply.code(409).send({ error: error.message });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Unlike a target
  fastify.delete('', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { target_type, target_id } = query;
      const user = request.user as any;

      if (!target_type || !target_id) {
        return reply.code(400).send({ error: 'Missing required parameters: target_type, target_id' });
      }

      const result = await unlikeTarget(user.username, target_type, target_id);

      // Emit generic real-time event
      fastify.io?.emit('like:deleted', {
        target_type,
        target_id,
        user_username: user.username
      });

      // Special handling for entity-specific updates
      switch (target_type) {
        case 'post':
          fastify.io?.emit('post_updated', {
            type: 'unlike',
            post_id: target_id,
            likes_count: result.likes_count,
            user_username: user.username
          });
          break;
        case 'story':
          fastify.io?.emit('story_updated', {
            type: 'unlike',
            story_id: target_id,
            likes_count: result.likes_count,
            user_username: user.username
          });
          break;
        case 'comment':
          fastify.io?.emit('comment_updated', {
            type: 'unlike',
            comment_id: target_id,
            likes_count: result.likes_count,
            user_username: user.username
          });
          break;
        case 'live_session':
          fastify.io?.to(`live-session-${target_id}`).emit('live-session-unliked', {
            session_id: target_id,
            likes: result.likes_count
          });
          break;
      }

      reply.send(result);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return reply.code(404).send({ error: error.message });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get likes count for a target
  fastify.get('/count', async (request, reply) => {
    try {
      const query = request.query as any;
      const { target_type, target_id } = query;

      if (!target_type || !target_id) {
        return reply.code(400).send({ error: 'Missing required parameters: target_type, target_id' });
      }

      const count = await Like.countDocuments({ target_type, target_id });

      reply.send({ count });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get user's likes
  fastify.get('/user', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        target_type,
        limit = 20,
        skip = 0
      } = query;
      const user = request.user as any;

      const filter: any = { 
        user_username: user.username.toLowerCase()
      };
      if (target_type) filter.target_type = target_type;

      const likes = await Like
        .find(filter)
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .lean({ virtuals: true });

      const total = await Like.countDocuments(filter);

      reply.send({
        data: likes,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > parseInt(skip) + parseInt(limit)
        }
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });
}
