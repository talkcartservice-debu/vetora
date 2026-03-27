import { FastifyInstance } from 'fastify';
import { Follow, IFollow } from '../models/Follow';
import { User } from '../models/User';
import { Store } from '../models/Store';
import { Community } from '../models/Community';
import { Notification } from '../models/Notification';

export async function followRoutes(fastify: FastifyInstance) {
  // Get follows for a user
  fastify.get('/', async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        follower_username,
        following_username,
        follow_type,
        limit = 50,
        skip = 0
      } = query;

      // Build filter object
      const filter: any = {};

      if (follower_username) filter.follower_username = follower_username;
      if (following_username) filter.following_username = following_username;
      if (follow_type) filter.follow_type = follow_type;

      const follows = await Follow
        .find(filter)
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const total = await Follow.countDocuments(filter);

      reply.send({
        data: follows,
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

  // Follow a user/store/community
  fastify.post('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const body = request.body as { following_username: string; follow_type?: string; target_id?: string };
      const user = request.user as any;

      const { following_username, follow_type = 'user', target_id } = body;

      // Validate follow_type
      const validTypes = ['user', 'store', 'community'];
      if (!validTypes.includes(follow_type)) {
        return reply.code(400).send({ error: 'Invalid follow_type. Must be user, store, or community' });
      }

      // Prevent self-following
      if (follow_type === 'user' && following_username === user.username) {
        return reply.code(400).send({ error: 'You cannot follow yourself' });
      }

      // Check if target exists
      let targetUser = null;
      let targetExists = false;
      switch (follow_type) {
        case 'user':
          targetUser = await User.findOne({ username: following_username });
          targetExists = !!targetUser;
          break;
        case 'store':
          targetExists = !!(await Store.findById(target_id));
          break;
        case 'community':
          targetExists = !!(await Community.findById(target_id));
          break;
      }

      if (!targetExists) {
        return reply.code(404).send({ error: `${follow_type} not found` });
      }

      // Check if already following
      const existingFollow = await Follow.findOne({
        follower_username: user.username,
        following_username,
        follow_type,
        ...(target_id && { target_id })
      });

      if (existingFollow) {
        return reply.code(409).send({ error: 'You are already following this entity' });
      }

      const follow = new Follow({
        follower_username: user.username,
        following_username,
        follow_type,
        target_id,
      });

      await follow.save();

      // Update counts
      await User.findOneAndUpdate({ username: user.username }, { $inc: { following_count: 1 } });
      
      let recipientUsername = targetUser?.username;
      let title = `${user.display_name || user.username} started following you`;
      let link = `/profile?username=${user.username}`;

      if (follow_type === 'user') {
        await User.findOneAndUpdate({ username: following_username }, { $inc: { follower_count: 1 } });
      } else if (follow_type === 'store' && target_id) {
        const store = await Store.findByIdAndUpdate(target_id, { $inc: { follower_count: 1 } });
        if (store) {
          recipientUsername = store.owner_username;
          title = `${user.display_name || user.username} started following your store: ${store.name}`;
          link = `/store?id=${store._id}`;
        }
      }

      // Create notification for the target
      if (recipientUsername && recipientUsername !== user.username) {
        const notification = new Notification({
          recipient_username: recipientUsername,
          type: 'follow',
          title,
          sender_username: user.username,
          sender_name: user.display_name || user.username,
          link,
          metadata: {
            follow_id: follow._id,
            follow_type,
            target_id
          }
        });
        await notification.save();
        
        // Emit notification via socket
        fastify.io?.to(recipientUsername).emit('notification:new', notification);
      }

      // Emit real-time event
      fastify.io?.emit('follow:created', {
        follow: follow.toObject()
      });

      reply.code(201).send(follow);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Unfollow a user/store/community
  fastify.delete('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { following_username, follow_type = 'user', target_id } = query;
      const user = request.user as any;

      const follow = await Follow.findOneAndDelete({
        follower_username: user.username,
        following_username,
        follow_type,
        ...(target_id && { target_id })
      });

      if (!follow) {
        return reply.code(404).send({ error: 'Follow relationship not found' });
      }

      // Update counts
      await User.findOneAndUpdate({ username: user.username }, { $inc: { following_count: -1 } });
      
      if (follow_type === 'user') {
        await User.findOneAndUpdate({ username: following_username }, { $inc: { follower_count: -1 } });
      } else if (follow_type === 'store' && target_id) {
        await Store.findByIdAndUpdate(target_id, { $inc: { follower_count: -1 } });
      }

      // Emit real-time event
      fastify.io?.emit('follow:deleted', {
        follow_id: follow._id,
        following_username,
        follow_type,
        target_id
      });

      reply.send({ message: 'Successfully unfollowed' });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Check if user is following
  fastify.get('/check', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { following_username, follow_type = 'user', target_id } = query;
      const user = request.user as any;

      const follow = await Follow.findOne({
        follower_username: user.username,
        following_username,
        follow_type,
        ...(target_id && { target_id })
      });

      reply.send({ is_following: !!follow });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get followers of a user/store/community
  fastify.get('/followers', async (request, reply) => {
    try {
      const query = request.query as any;
      const { following_username, follow_type = 'user', target_id, limit = 20, skip = 0 } = query;

      const filter: any = {
        following_username,
        follow_type,
        ...(target_id && { target_id })
      };

      const followers = await Follow
        .find(filter)
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      // follower_username is a string, so we can't use .populate()
      // If we need user info, we would need to fetch them separately by username.

      const total = await Follow.countDocuments(filter);

      reply.send({
        followers,
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

  // Get following list of a user
  fastify.get('/following', async (request, reply) => {
    try {
      const query = request.query as any;
      const { follower_username, follow_type, limit = 20, skip = 0 } = query;

      const filter: any = { follower_username };
      if (follow_type) filter.follow_type = follow_type;

      const following = await Follow
        .find(filter)
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const total = await Follow.countDocuments(filter);

      reply.send({
        following,
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

  // Get follow counts for a user/store/community
  fastify.get('/counts', async (request, reply) => {
    try {
      const query = request.query as any;
      const { following_username, follow_type = 'user', target_id } = query;

      const filter: any = {
        following_username,
        follow_type,
        ...(target_id && { target_id })
      };

      const followerCount = await Follow.countDocuments(filter);

      // For user follows, also get following count
      let followingCount = 0;
      if (follow_type === 'user') {
        followingCount = await Follow.countDocuments({
          follower_username: following_username,
          follow_type: 'user'
        });
      }

      reply.send({
        follower_count: followerCount,
        following_count: followingCount
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get my follows (following)
  fastify.get('/me/following', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { follow_type, limit = 20, skip = 0 } = query;
      const user = request.user as any;

      const filter: any = { follower_username: user.username };
      if (follow_type) filter.follow_type = follow_type;

      const following = await Follow
        .find(filter)
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const total = await Follow.countDocuments(filter);

      reply.send({
        following,
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

  // Get my followers
  fastify.get('/me/followers', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { follow_type = 'user', limit = 20, skip = 0 } = query;
      const user = request.user as any;

      const filter: any = {
        following_username: user.username,
        follow_type
      };

      const followers = await Follow
        .find(filter)
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      // follower_username is a string, so we can't use .populate()
      // If we need user info, we would need to fetch them separately by username.

      const total = await Follow.countDocuments(filter);

      reply.send({
        followers,
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