import { FastifyInstance } from 'fastify';
import { Comment, IComment } from '../models/Comment';
import { User } from '../models/User';

export async function commentRoutes(fastify: FastifyInstance) {
  // List comments for a post with pagination
  fastify.get('/', async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        post_id,
        parent_comment_id,
        author_username,
        sort = '-created_at',
        limit = 20,
        skip = 0
      } = query;

      // Build filter object
      const filter: any = {};

      if (post_id) filter.post_id = post_id;
      if (parent_comment_id !== undefined) {
        if (parent_comment_id) {
          filter.parent_comment_id = parent_comment_id;
        } else {
          filter.parent_comment_id = { $exists: false };
        }
      }
      if (author_username) filter.author_username = author_username;

      // Build sort object
      const sortObj: any = {};
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const comments = await Comment
        .find(filter)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      // post_id is a string, so we can't use .populate()
      // If we need post info, we would need to fetch it separately.

      const total = await Comment.countDocuments(filter);

      reply.send({
        comments,
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

  // Get comment by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const comment = await Comment.findById(id);

      if (!comment) {
        return reply.code(404).send({ error: 'Comment not found' });
      }

      reply.send(comment);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Create comment
  fastify.post('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const body = request.body as Partial<IComment>;
      const user = request.user as any;

      // Validate required fields
      if (!body.post_id || !body.content) {
        return reply.code(400).send({ error: 'Missing required fields: post_id, content' });
      }

      const comment = new Comment({
        ...body,
        author_username: user.username,
        author_name: user.display_name || user.full_name || user.username,
        author_avatar: user.avatar_url,
      });

      await comment.save();

      // Emit real-time event
      fastify.io?.emit('comment:created', {
        comment: comment.toObject(),
        post_id: body.post_id
      });

      reply.code(201).send(comment);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update comment
  fastify.put('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Partial<IComment>;
      const user = request.user as any;

      const comment = await Comment.findById(id);

      if (!comment) {
        return reply.code(404).send({ error: 'Comment not found' });
      }

      // Check if user owns the comment
      const isOwner = comment.author_username === user.username;
      if (!isOwner) {
        return reply.code(403).send({ error: 'You can only update your own comments' });
      }

      // Update allowed fields
      const allowedUpdates = ['content'];
      allowedUpdates.forEach(field => {
        const key = field as keyof IComment;
        if (body[key] !== undefined) {
          (comment as any)[key] = body[key];
        }
      });

      await comment.save();

      // Emit real-time event
      fastify.io?.emit('comment:updated', {
        comment: comment.toObject(),
        post_id: comment.post_id
      });

      reply.send(comment);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete comment
  fastify.delete('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const comment = await Comment.findById(id);

      if (!comment) {
        return reply.code(404).send({ error: 'Comment not found' });
      }

      // Check if user owns the comment
      const isOwner = comment.author_username === user.username;
      if (!isOwner) {
        return reply.code(403).send({ error: 'You can only delete your own comments' });
      }

      // Delete the comment and all its replies
      await Comment.deleteMany({
        $or: [
          { _id: id },
          { parent_comment_id: id }
        ]
      });

      // Emit real-time event
      fastify.io?.emit('comment:deleted', {
        comment_id: id,
        post_id: comment.post_id
      });

      reply.send({ message: 'Comment and replies deleted successfully' });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Like/Unlike comment
  fastify.post('/:id/like', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const comment = await Comment.findById(id);

      if (!comment) {
        return reply.code(404).send({ error: 'Comment not found' });
      }

      // TODO: Implement proper like tracking with a separate collection
      // For now, just increment the count
      comment.likes_count += 1;
      await comment.save();

      // Emit real-time event
      fastify.io?.emit('comment:liked', {
        comment_id: id,
        post_id: comment.post_id,
        likes_count: comment.likes_count
      });

      reply.send({ likes_count: comment.likes_count });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get comment thread (comment + all replies)
  fastify.get('/:id/thread', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const comment = await Comment.findById(id);

      if (!comment) {
        return reply.code(404).send({ error: 'Comment not found' });
      }

      // Get all replies
      const replies = await Comment
        .find({ parent_comment_id: id })
        .sort({ created_at: 1 });

      reply.send({
        comment,
        replies,
        total_replies: replies.length
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });
}