import { FastifyInstance } from 'fastify';
import { Story, IStory } from '../models/Story';
import { User } from '../models/User';
import { Follow } from '../models/Follow';

export async function storyRoutes(fastify: FastifyInstance) {
  // Get active stories feed (from users you follow + your own)
  fastify.get('/feed', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const user = request.user as any;

      // Get users that the current user follows
      const following = await Follow.find({
        follower_email: user.email,
        follow_type: 'user'
      }).select('following_email');

      const followingEmails = following.map(f => f.following_email);
      followingEmails.push(user.email); // Include own stories

      const stories = await Story
        .find({
          author_email: { $in: followingEmails },
          is_active: true,
          expires_at: { $gt: new Date() }
        })
        .sort({ created_at: -1 })
        .limit(50);

      // Group by author - use email string from document
      const groupedStories = stories.reduce((acc, story) => {
        const authorEmail = story.author_email;
        if (!acc[authorEmail]) {
          acc[authorEmail] = {
            author: {
              email: authorEmail,
              name: story.author_name || authorEmail.split('@')[0],
              avatar: story.author_avatar
            },
            stories: []
          };
        }
        acc[authorEmail].stories.push(story);
        return acc;
      }, {} as Record<string, any>);

      reply.send({ feed: Object.values(groupedStories) });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // List stories with filtering
  fastify.get('/', async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        author_email,
        is_active = true,
        sort = '-created_at',
        limit = 20,
        skip = 0
      } = query;

      // Build filter object
      const filter: any = {};

      if (author_email) filter.author_email = author_email;
      if (is_active !== undefined) filter.is_active = is_active === 'true';

      // Build sort object
      const sortObj: any = {};
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const stories = await Story
        .find(filter)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const total = await Story.countDocuments(filter);

      reply.send({
        data: stories,
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

  // Get story by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const story = await Story.findById(id);

      if (!story) {
        return reply.code(404).send({ error: 'Story not found' });
      }

      reply.send(story);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Create story
  fastify.post('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const body = request.body as Partial<IStory>;
      const authUser = request.user as any;
      
      // Fetch full user data to get display_name and avatar_url
      const user = await User.findOne({ email: authUser.email });
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Log incoming story for debugging
      fastify.log.info(`Creating story for ${user.email}: ${JSON.stringify(body)}`);

      // Validate required fields
      if (!body.media_type) {
        return reply.code(400).send({ error: 'Missing required field: media_type' });
      }

      // Validate media_type
      const validTypes = ['image', 'video', 'text'];
      if (!validTypes.includes(body.media_type)) {
        return reply.code(400).send({ error: `Invalid media_type: ${body.media_type}. Must be image, video, or text` });
      }

      // For non-text stories, media_url is required
      if (body.media_type !== 'text' && !body.media_url?.trim()) {
        fastify.log.warn(`Rejected story for ${user.email}: missing media_url for ${body.media_type}`);
        return reply.code(400).send({ error: `media_url is required for ${body.media_type} stories` });
      }

      const story = new Story({
        ...body,
        media_url: body.media_url?.trim() || "",
        author_email: user.email,
        author_name: user.display_name || user.email,
        author_avatar: user.avatar_url,
      });

      await story.save();

      // Emit real-time event
      fastify.io?.emit('story:created', {
        story: story.toObject()
      });

      reply.code(201).send(story);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Update story
  fastify.put('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Partial<IStory>;
      const user = request.user as any;

      const story = await Story.findById(id);

      if (!story) {
        return reply.code(404).send({ error: 'Story not found' });
      }

      // Check if user owns the story
      if (story.author_email !== user.email) {
        return reply.code(403).send({ error: 'You can only update your own stories' });
      }

      // Update allowed fields
      const allowedUpdates = ['caption', 'bg_color'];
      allowedUpdates.forEach(field => {
        const key = field as keyof IStory;
        if (body[key] !== undefined) {
          (story as any)[key] = body[key];
        }
      });

      await story.save();

      reply.send(story);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Delete story
  fastify.delete('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const story = await Story.findById(id);

      if (!story) {
        return reply.code(404).send({ error: 'Story not found' });
      }

      // Check if user owns the story
      if (story.author_email !== user.email) {
        return reply.code(403).send({ error: 'You can only delete your own stories' });
      }

      await Story.findByIdAndDelete(id);

      // Emit real-time event
      fastify.io?.emit('story:deleted', {
        story_id: id,
        author_email: story.author_email
      });

      reply.send({ message: 'Story deleted successfully' });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Mark story as viewed
  fastify.post('/:id/view', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const story = await Story.findById(id);

      if (!story) {
        return reply.code(404).send({ error: 'Story not found' });
      }

      if (!story.is_active || story.expires_at <= new Date()) {
        return reply.code(400).send({ error: 'Story is no longer active' });
      }

      // Increment view count
      story.views_count += 1;
      await story.save();

      // TODO: Track individual viewers to prevent multiple views from same user
      // For now, just increment the count

      reply.send({ views_count: story.views_count });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });
  
  // Like a story
  fastify.post('/:id/like', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      
      const story = await Story.findById(id);
      
      if (!story) {
        return reply.code(404).send({ error: 'Story not found' });
      }
      
      if (!story.is_active || story.expires_at <= new Date()) {
        return reply.code(400).send({ error: 'Story is no longer active' });
      }
      
      // Increment likes count
      story.likes_count = (story.likes_count || 0) + 1;
      await story.save();
      
      // Emit real-time event
      fastify.io?.emit('story:liked', {
        story_id: id,
        likes_count: story.likes_count
      });
      
      reply.send({ likes_count: story.likes_count });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Reply to a story
  fastify.post('/:id/reply', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { text } = request.body as { text: string };
      const user = request.user as any;
      
      if (!text) {
        return reply.code(400).send({ error: 'Reply text is required' });
      }
      
      const story = await Story.findById(id);
      
      if (!story) {
        return reply.code(404).send({ error: 'Story not found' });
      }
      
      // We'll treat story replies as direct messages
      // This would normally be handled by a message service
      // For now, we'll just log it or you can integrate with messages route
      
      reply.send({ message: 'Reply sent successfully' });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get user's active stories
  fastify.get('/user/me', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const user = request.user as any;

      const stories = await Story
        .find({
          author_email: user.email,
          is_active: true,
          expires_at: { $gt: new Date() }
        })
        .sort({ created_at: -1 });

      reply.send({ stories });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get stories by user
  fastify.get('/user/:email', async (request, reply) => {
    try {
      const { email } = request.params as { email: string };

      const stories = await Story
        .find({
          author_email: email.toLowerCase(),
          is_active: true,
          expires_at: { $gt: new Date() }
        })
        .sort({ created_at: -1 });

      // Since author_email is a string, we can't use .populate(). 
      // Instead, we'll manually fetch the user data if needed, or just return what we have.
      // The current Story model already has author_name and author_avatar.

      reply.send({ stories });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Clean up expired stories (admin endpoint)
  fastify.post('/cleanup', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const user = request.user as any;

      // TODO: Add admin check
      // For now, allow any authenticated user

      const result = await Story.updateMany(
        {
          expires_at: { $lt: new Date() },
          is_active: true
        },
        { is_active: false }
      );

      reply.send({
        message: 'Expired stories cleaned up',
        updated_count: result.modifiedCount
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