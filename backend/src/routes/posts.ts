import { FastifyInstance } from 'fastify';
import { Post, IPost } from '../models/Post';
import { User } from '../models/User';
import { Like } from '../models/Like';
import { Follow } from '../models/Follow';
import { z } from 'zod';

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
  likes_count: z.number().default(0),
  comments_count: z.number().default(0),
  shares_count: z.number().default(0),
});

export async function postRoutes(fastify: FastifyInstance) {
  // List posts with filtering and pagination
  fastify.get('/', async (request, reply) => {
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
        skip = 0,
        sort = '-created_at'
      } = query;

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
          return { data: [], total: 0, limit: parseInt(limit), skip: parseInt(skip) };
        }
      }

      if (search) {
        filter.content = { $regex: search, $options: 'i' };
      }

      const posts = await Post.find(filter)
        .sort(sort)
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .lean();

      const total = await Post.countDocuments(filter);

      return {
        data: posts,
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

  // Get post by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const post = await Post.findById(id).lean();

      if (!post) {
        return reply.code(404).send({ error: 'Post not found' });
      }

      return post;
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

  // Like a post
  fastify.post('/:id/like', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      if (!user?.username) {
        return reply.code(401).send({ error: 'Unauthorized - invalid user data' });
      }

      // Check if already liked
      const existingLike = await Like.findOne({
        user_username: user.username, 
        target_id: id, 
        target_type: 'post'
      });

      if (existingLike) {
        return reply.code(400).send({ error: 'Post already liked' });
      }

      const like = new Like({
        user_username: user.username,
        target_id: id,
        target_type: 'post'
      });

      await like.save();

      // Increment likes count on post
      await Post.findByIdAndUpdate(id, { $inc: { likes_count: 1 } });

      return { status: 'liked' };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Unlike a post
  fastify.delete('/:id/like', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      if (!user?.username) {
        return reply.code(401).send({ error: 'Unauthorized - invalid user data' });
      }

      fastify.log.info(`User ${user.username} unliking post ${id}`);

      const result = await Like.deleteOne({
        user_username: user.username,
        target_id: id,
        target_type: 'post'
      });

      if (result.deletedCount === 0) {
        fastify.log.warn(`Like not found for user ${user.username} on post ${id}`);
        // Return 200 anyway to keep frontend in sync if it thinks it's liked
        return { status: 'unliked', message: 'Like already removed or not found' };
      }

      // Decrement likes count on post
      await Post.findByIdAndUpdate(id, { $inc: { likes_count: -1 } });

      return { status: 'unliked' };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
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

      const post = await Post.findById(id);
      if (!post) {
        return reply.code(404).send({ error: 'Post not found' });
      }

      const user = request.user as any;
      if (post.author_name !== user.name) {
        return reply.code(403).send({ error: 'Unauthorized' });
      }

      const updatedPost = await Post.findByIdAndUpdate(id, body, { new: true });
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