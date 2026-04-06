import { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { Post, IPost } from '../models/Post';
import { User } from '../models/User';
import { Follow } from '../models/Follow';
import { z } from 'zod';
import { likeTarget, unlikeTarget, getLikesForTargets, checkIfLiked } from '../services/likeService';

const createPostSchema = z.object({
  content: z.string().default(''),
  media_urls: z.array(z.string()).default([]),
  media_type: z.enum(['image', 'video', 'text', 'product_review']).default('text'),
  tagged_products: z.array(z.string().nullable()).transform(arr => (arr || []).filter(item => typeof item === 'string')).default([]),
  community_id: z.string().optional().nullable(),
  visibility: z.enum(['public', 'followers', 'community']).default('public'),
  // Optional fields that can be provided but are not required
  author_username: z.string().optional().nullable(),
  author_name: z.string().optional().nullable(),
});

export async function postRoutes(fastify: FastifyInstance) {
  // List posts with filtering and pagination
  fastify.get('/', {
    preHandler: [fastify.authenticateOptional],
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        author_username,
        community_id,
        visibility = 'public',
        following_only,
        user_username,
        search,
        limit = 20,
        skip,
        page = 1,
        sort = '-created_at'
      } = query;

      const parsedLimit = parseInt(limit);
      const parsedPage = parseInt(page);
      const parsedSkip = (skip !== undefined && skip !== null) ? parseInt(skip) : (parsedPage - 1) * parsedLimit;

      const filter: any = {};
      if (author_username) filter.author_username = author_username;
      if (community_id) filter.community_id = community_id;
      if (visibility) filter.visibility = visibility;

      if (following_only === 'true' && user_username && typeof user_username === 'string') {
        const follower_username = user_username.toLowerCase();
        const follows = await Follow.find({ follower_username }).lean();
        const followingEmails = follows.map((f: any) => f.following_email).filter(Boolean);
        const followingUsernames = follows.map(f => f.following_username).filter(Boolean);
        
        // If following no one, we should probably return empty array or handle it
        if (followingUsernames.length > 0 || followingEmails.length > 0) {
          filter.$or = [
            { author_username: { $in: followingUsernames } },
            { author_email: { $in: followingEmails } }
          ];
        } else {
          // Special case: following no one, so return empty list
          return { data: [], total: 0, limit: parsedLimit, skip: parsedSkip, page: parsedPage };
        }
      }

      if (search) {
        filter.content = { $regex: search, $options: 'i' };
      }

      const posts = await Post.find(filter)
        .sort(sort)
        .limit(parsedLimit)
        .skip(parsedSkip)
        .lean({ virtuals: true });

      const total = await Post.countDocuments(filter);

      // Get current user's likes in bulk for the fetched posts
      const user = request.user as any;
      const effectiveUsername = user?.username || user_username;
      let userLikesSet = new Set<string>();

      if (effectiveUsername) {
        const postIds = posts.map((p: any) => p._id.toString());
        userLikesSet = await getLikesForTargets(effectiveUsername.toString(), 'post', postIds);
      }

      // Add is_liked field to each post
      const postsWithLikeStatus = posts.map((post: any) => {
        const id = post._id.toString();
        const is_liked = userLikesSet.has(id);
        return { 
          ...post, 
          id, 
          is_liked 
        };
      });

      return {
        data: postsWithLikeStatus,
        total,
        limit: parsedLimit,
        skip: parsedSkip,
        page: parsedPage,
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get post by ID
  fastify.get('/:id', {
    preHandler: [fastify.authenticateOptional],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const post = await Post.findById(id).lean({ virtuals: true }) as any;

      if (!post) {
        return reply.code(404).send({ error: 'Post not found' });
      }

      // Add is_liked field
      const user = request.user as any;
      const query = request.query as any;
      const user_username = query?.user_username;
      const effectiveUsername = user?.username || user_username;
      
      let is_liked = false;
      if (effectiveUsername) {
        is_liked = await checkIfLiked(effectiveUsername.toString(), 'post', id);
      }

      return { 
        ...post, 
        id: post._id.toString(), 
        is_liked 
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Create post
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      
      // Log the incoming request body for debugging
      fastify.log.info(`Creating post with body: ${JSON.stringify(request.body)}`);
      
      const body = createPostSchema.parse(request.body);

      const post = new Post({
        ...body,
        author_username: user.username,
        author_name: user?.display_name || user.username,
        author_avatar: user?.avatar_url,
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      });

      await post.save();
      
      fastify.log.info(`Post created successfully: ${post._id}`);
      return post;
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const errorMsg = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        fastify.log.error(`Validation error: ${errorMsg}`);
        return reply.code(400).send({ 
          error: `Invalid request data: ${errorMsg}`, 
          details: error.errors 
        });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error', message: error.message });
    }
  });

  // Delete post
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      if (!user?.username) {
        return reply.code(401).send({ error: 'Unauthorized - invalid user data' });
      }

      const post = await Post.findById(id);
      if (!post) {
        return reply.code(404).send({ error: 'Post not found' });
      }

      if (post.author_username !== user.username) {
        return reply.code(403).send({ error: 'Unauthorized' });
      }

      await Post.deleteOne({ _id: id });
      return { status: 'deleted' };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Update post (for share increment, etc.)
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const user = request.user as any;

      const post = await Post.findById(id);
      if (!post) {
        return reply.code(404).send({ error: 'Post not found' });
      }

      // Handle share count increment separately (anyone can share)
      if (body.$inc && body.$inc.shares_count === 1) {
        const updatedPost = await Post.findByIdAndUpdate(
          id, 
          { $inc: { shares_count: 1 } }, 
          { new: true }
        );
        return updatedPost;
      }

      // Other updates require ownership
      if (post.author_username !== user.username) {
        return reply.code(403).send({ error: 'Unauthorized' });
      }

      // Filter body to only allow safe updates, NOT counters
      const { likes_count, comments_count, shares_count, author_username, ...safeBody } = body;
      
      const updatedPost = await Post.findByIdAndUpdate(id, safeBody, { new: true });
      return updatedPost;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });
}