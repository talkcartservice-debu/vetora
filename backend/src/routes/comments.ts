import { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { Comment, IComment } from '../models/Comment';
import { User } from '../models/User';
import { Post } from '../models/Post';
import { Like } from '../models/Like';

export async function commentRoutes(fastify: FastifyInstance) {
  // List comments for a post with pagination
  fastify.get('/', {
    preHandler: [fastify.authenticateOptional]
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        post_id,
        parent_comment_id,
        author_username,
        user_username,
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
        .skip(parseInt(skip))
        .lean({ virtuals: true });

      const total = await Comment.countDocuments(filter);

      // Add is_liked field
      const user = request.user as any;
      const effectiveUsername = user?.username || user_username;
      let userLikesSet = new Set<string>();

      if (effectiveUsername && typeof effectiveUsername === 'string') {
        const commentIds = comments.map((c: any) => c._id.toString());
        const likes = await Like.find({
          user_username: effectiveUsername.toLowerCase(),
          target_type: 'comment',
          target_id: { $in: commentIds }
        }).select('target_id').lean();
        
        userLikesSet = new Set(likes.map((l: any) => l.target_id.toString()));
      }

      const commentsWithLikeStatus = comments.map((comment: any) => ({
        ...comment,
        id: comment._id.toString(),
        is_liked: userLikesSet.has(comment._id.toString())
      }));

      reply.send({
        comments: commentsWithLikeStatus,
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
        author_name: user.display_name || user.username,
        author_avatar: user.avatar_url,
      });

      await comment.save();

      // Increment comments count on post if it's a top-level comment or directly on a post
      if (body.post_id) {
        await Post.findByIdAndUpdate(body.post_id, { $inc: { comments_count: 1 } });
      }

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
      const deletedCount = await Comment.countDocuments({
        $or: [
          { _id: id },
          { parent_comment_id: id }
        ]
      });

      await Comment.deleteMany({
        $or: [
          { _id: id },
          { parent_comment_id: id }
        ]
      });

      // Decrement comments count on post
      if (comment.post_id) {
        await Post.findByIdAndUpdate(comment.post_id, { $inc: { comments_count: -deletedCount } });
      }

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

  // Like a comment
  fastify.post('/:id/like', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      if (!user?.username) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const comment = await Comment.findById(id);
      if (!comment) {
        return reply.code(404).send({ error: 'Comment not found' });
      }

      // Check if already liked
      const existingLike = await Like.findOne({
        user_username: user.username.toLowerCase(),
        target_id: id,
        target_type: 'comment'
      });

      if (existingLike) {
        return reply.code(400).send({ error: 'Comment already liked' });
      }

      const like = new Like({
        user_username: user.username.toLowerCase(),
        target_id: id,
        target_type: 'comment'
      });

      await like.save();

      // Increment likes count
      const updatedComment = await Comment.findByIdAndUpdate(
        id,
        { $inc: { likes_count: 1 } },
        { new: true, lean: true }
      );

      // Emit real-time event
      fastify.io?.emit('comment_updated', {
        type: 'like',
        comment_id: id,
        post_id: comment.post_id,
        likes_count: updatedComment?.likes_count || 0,
        user_username: user.username
      });

      return { 
        status: 'liked', 
        likes_count: updatedComment?.likes_count || 0,
        is_liked: true
      };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Unlike a comment
  fastify.delete('/:id/like', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      if (!user?.username) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const result = await Like.deleteOne({
        user_username: user.username.toLowerCase(),
        target_id: id,
        target_type: 'comment'
      });

      if (result.deletedCount === 0) {
        return reply.code(404).send({ error: 'Like not found' });
      }

      // Decrement likes count
      const updatedComment = await Comment.findOneAndUpdate(
        { _id: id, likes_count: { $gt: 0 } },
        { $inc: { likes_count: -1 } },
        { new: true, lean: true }
      );

      const finalComment = updatedComment || await Comment.findById(id).lean();

      // Emit real-time event
      fastify.io?.emit('comment_updated', {
        type: 'unlike',
        comment_id: id,
        post_id: finalComment?.post_id,
        likes_count: finalComment?.likes_count || 0,
        user_username: user.username
      });

      return { 
        status: 'unliked', 
        likes_count: finalComment?.likes_count || 0,
        is_liked: false
      };
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