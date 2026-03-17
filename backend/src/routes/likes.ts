import { FastifyInstance } from 'fastify';
import { Like, ILike } from '../models/Like';
import { Post } from '../models/Post';
import { Comment } from '../models/Comment';
import { Product } from '../models/Product';
import { Review } from '../models/Review';

export async function likeRoutes(fastify: FastifyInstance) {
  // Get likes for a specific target
  fastify.get('/', async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        target_type,
        target_id,
        user_email,
        limit = 50,
        skip = 0
      } = query;

      // Build filter object
      const filter: any = {};

      if (target_type) filter.target_type = target_type;
      if (target_id) filter.target_id = target_id;
      if (user_email) filter.user_email = user_email;

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
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
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
        user_email: user.email,
        target_type,
        target_id
      });

      reply.send({ has_liked: !!like });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Like a target
  fastify.post('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const body = request.body as { target_type: string; target_id: string };
      const user = request.user as any;

      const { target_type, target_id } = body;

      // Validate target_type
      const validTypes = ['post', 'comment', 'product', 'review'];
      if (!validTypes.includes(target_type)) {
        return reply.code(400).send({ error: 'Invalid target_type. Must be one of: post, comment, product, review' });
      }

      // Check if target exists
      let targetExists = false;
      switch (target_type) {
        case 'post':
          targetExists = !!(await Post.findById(target_id));
          break;
        case 'comment':
          targetExists = !!(await Comment.findById(target_id));
          break;
        case 'product':
          targetExists = !!(await Product.findById(target_id));
          break;
        case 'review':
          targetExists = !!(await Review.findById(target_id));
          break;
      }

      if (!targetExists) {
        return reply.code(404).send({ error: `${target_type} not found` });
      }

      // Check if user already liked this target
      const existingLike = await Like.findOne({
        user_email: user.email,
        target_type,
        target_id
      });

      if (existingLike) {
        return reply.code(409).send({ error: 'You have already liked this item' });
      }

      const like = new Like({
        user_email: user.email,
        target_type,
        target_id
      });

      await like.save();

      // Update the likes count on the target
      await updateLikesCount(target_type, target_id, 1);

      // Emit real-time event
      fastify.io?.emit('like:created', {
        like: like.toObject(),
        target_type,
        target_id
      });

      reply.code(201).send(like);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Unlike a target
  fastify.delete('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { target_type, target_id } = query;
      const user = request.user as any;

      if (!target_type || !target_id) {
        return reply.code(400).send({ error: 'Missing required parameters: target_type, target_id' });
      }

      const like = await Like.findOneAndDelete({
        user_email: user.email,
        target_type,
        target_id
      });

      if (!like) {
        return reply.code(404).send({ error: 'Like not found' });
      }

      // Update the likes count on the target
      await updateLikesCount(target_type, target_id, -1);

      // Emit real-time event
      fastify.io?.emit('like:deleted', {
        like_id: like._id,
        target_type,
        target_id
      });

      reply.send({ message: 'Like removed successfully' });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
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
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
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

      const filter: any = { user_email: user.email };
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
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

// Helper function to update likes count on target documents
async function updateLikesCount(target_type: string, target_id: string, increment: number) {
  try {
    switch (target_type) {
      case 'post':
        await Post.findByIdAndUpdate(target_id, { $inc: { likes_count: increment } });
        break;
      case 'comment':
        await Comment.findByIdAndUpdate(target_id, { $inc: { likes_count: increment } });
        break;
      case 'product':
        // Products might not have likes_count field, skip for now
        break;
      case 'review':
        // Reviews might not have likes_count field, skip for now
        break;
    }
  } catch (error) {
    console.error('Error updating likes count:', error);
  }
}