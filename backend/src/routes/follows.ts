import { FastifyInstance } from 'fastify';
import { Follow, IFollow } from '../models/Follow';
import { User } from '../models/User';
import { Store } from '../models/Store';
import { Community } from '../models/Community';
import { Notification } from '../models/Notification';

// Helper to parse pagination
const getPagination = (query: any) => {
  const limit = Math.min(parseInt(query.limit) || 20, 100);
  const skip = Math.max(parseInt(query.skip) || 0, 0);
  return { limit, skip };
};

export async function followRoutes(fastify: FastifyInstance) {
  // Get follows for a user
  fastify.get('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        follower_username,
        following_username,
        follow_type,
      } = query;

      const { limit, skip } = getPagination(query);

      // Build filter object
      const filter: any = {};

      if (follower_username) filter.follower_username = follower_username;
      if (following_username) filter.following_username = following_username;
      if (follow_type) filter.follow_type = follow_type;

      const follows = await Follow
        .find(filter)
        .sort({ created_at: -1 })
        .limit(limit)
        .skip(skip);

      const total = await Follow.countDocuments(filter);

      reply.send({
        data: follows,
        pagination: {
          total,
          limit,
          skip,
          hasMore: total > skip + limit
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

      // Validate target_id for store/community
      if ((follow_type === 'store' || follow_type === 'community') && !target_id) {
        return reply.code(400).send({ error: `target_id is required for follow_type: ${follow_type}` });
      }

      const lowerFollowingUsername = following_username?.toLowerCase();

      // Check if target exists
      let targetUser = null;
      let targetExists = false;
      let targetEntity: any = null;

      try {
        switch (follow_type) {
          case 'user':
            targetUser = await User.findOne({ username: lowerFollowingUsername });
            targetExists = !!targetUser;
            targetEntity = targetUser;
            break;
          case 'store':
            targetEntity = await Store.findById(target_id);
            targetExists = !!targetEntity;
            break;
          case 'community':
            targetEntity = await Community.findById(target_id);
            targetExists = !!targetEntity;
            break;
        }
      } catch (err: any) {
        // Handle invalid ObjectId format
        if (err.name === 'CastError') {
          return reply.code(400).send({ error: `Invalid target_id format: ${target_id}` });
        }
        throw err;
      }

      if (!targetExists) {
        return reply.code(404).send({ error: `${follow_type} not found` });
      }

      // For stores and communities, ensure following_username is set correctly if missing
      let finalFollowingUsername = lowerFollowingUsername;
      if (follow_type === 'store' && targetEntity) {
        finalFollowingUsername = targetEntity.owner_username || lowerFollowingUsername;
      } else if (follow_type === 'community' && targetEntity) {
        finalFollowingUsername = targetEntity.owner_username || lowerFollowingUsername;
      }
      
      // Ensure finalFollowingUsername is lowercased (it should be already if from DB, but just in case)
      if (finalFollowingUsername) {
        finalFollowingUsername = finalFollowingUsername.toLowerCase();
      }

      // Check if already following
      const existingFollow = await Follow.findOne({
        follower_username: user.username,
        following_username: finalFollowingUsername,
        follow_type,
        ...(target_id && { target_id })
      });

      if (existingFollow) {
        return reply.code(409).send({ error: 'You are already following this entity' });
      }

      const follow = new Follow({
        follower_username: user.username,
        following_username: finalFollowingUsername,
        follow_type,
        target_id,
      });

      await follow.save();

      // Get current user's display name if not in token
      let currentUserDisplayName = user.display_name;
      if (!currentUserDisplayName) {
        const currentUser = await User.findOne({ username: user.username });
        currentUserDisplayName = currentUser?.display_name || user.username;
      }

      // Update counts
      await User.findOneAndUpdate({ username: user.username }, { $inc: { following_count: 1 } });
      
      let recipientUsername = targetUser?.username;
      let title = `${currentUserDisplayName} started following you`;
      let link = `/profile?username=${user.username}`;

      if (follow_type === 'user') {
        await User.findOneAndUpdate({ username: finalFollowingUsername }, { $inc: { follower_count: 1 } });
      } else if (follow_type === 'store' && target_id) {
        if (targetEntity) {
          await Store.findByIdAndUpdate(target_id, { $inc: { follower_count: 1 } });
          recipientUsername = targetEntity.owner_username;
          title = `${currentUserDisplayName} started following your store: ${targetEntity.name}`;
          link = `/store?id=${targetEntity._id}`;
        }
      } else if (follow_type === 'community' && target_id) {
        if (targetEntity) {
          await Community.findByIdAndUpdate(target_id, { $inc: { member_count: 1 } });
          recipientUsername = targetEntity.owner_username;
          title = `${currentUserDisplayName} joined your community: ${targetEntity.name}`;
          link = `/communities/${targetEntity._id}`;
        }
      }

      // Create notification for the target
      if (recipientUsername && recipientUsername !== user.username) {
        try {
          const notification = new Notification({
            recipient_username: recipientUsername,
            type: 'follow',
            title,
            sender_username: user.username,
            sender_name: currentUserDisplayName,
            link,
            metadata: {
              follow_id: follow._id,
              follow_type,
              target_id
            }
          });
          await notification.save();
          
          // Emit notification via socket
          fastify.io?.to(`user:${recipientUsername}`).emit('notification:new', notification);
        } catch (notifErr: any) {
          fastify.log.error(notifErr, 'Failed to create/emit notification');
          // Don't fail the whole request if notification fails
        }
      }

      // Emit real-time events to relevant users only
      if (fastify.io) {
        try {
          // Emit to follower
          fastify.io.to(`user:${user.username}`).emit('follow:created', {
            follow: follow.toObject()
          });
          // Emit to followed user (if applicable)
          if (recipientUsername) {
            fastify.io.to(`user:${recipientUsername}`).emit('follow:created', {
              follow: follow.toObject()
            });
          }
        } catch (socketErr: any) {
          fastify.log.error(socketErr, 'Failed to emit socket events');
        }
      }

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

      // For stores and communities, ensure following_username is set correctly if missing
      let finalFollowingUsername = following_username?.toLowerCase();
      if ((follow_type === 'store' || follow_type === 'community') && target_id && !finalFollowingUsername) {
        try {
          const targetEntity = follow_type === 'store' 
            ? await Store.findById(target_id) 
            : await Community.findById(target_id);
          if (targetEntity) {
            finalFollowingUsername = targetEntity.owner_username?.toLowerCase();
          }
        } catch (err: any) {
          // Handle invalid ObjectId format
          if (err.name === 'CastError') {
            return reply.code(400).send({ error: `Invalid target_id format: ${target_id}` });
          }
          throw err;
        }
      } else if (finalFollowingUsername) {
        finalFollowingUsername = finalFollowingUsername.toLowerCase();
      }

      const follow = await Follow.findOneAndDelete({
        follower_username: user.username,
        following_username: finalFollowingUsername,
        follow_type,
        ...(target_id && { target_id })
      });

      if (!follow) {
        return reply.code(404).send({ error: 'Follow relationship not found' });
      }

      // Update counts
      await User.findOneAndUpdate({ username: user.username }, { $inc: { following_count: -1 } });
      
      let recipientUsername = finalFollowingUsername;
      if (follow_type === 'user') {
        await User.findOneAndUpdate({ username: finalFollowingUsername }, { $inc: { follower_count: -1 } });
      } else if (follow_type === 'store' && target_id) {
        const store = await Store.findByIdAndUpdate(target_id, { $inc: { follower_count: -1 } });
        recipientUsername = store?.owner_username?.toLowerCase() || finalFollowingUsername;
      } else if (follow_type === 'community' && target_id) {
        const community = await Community.findByIdAndUpdate(target_id, { $inc: { member_count: -1 } });
        recipientUsername = community?.owner_username?.toLowerCase() || finalFollowingUsername;
      }

      // Emit real-time events to relevant users only
      if (fastify.io) {
        try {
          fastify.io.to(`user:${user.username}`).emit('follow:deleted', {
            follow_id: follow._id,
            following_username: finalFollowingUsername,
            follow_type,
            target_id
          });
          if (recipientUsername) {
            fastify.io.to(`user:${recipientUsername}`).emit('follow:deleted', {
              follow_id: follow._id,
              following_username: finalFollowingUsername,
              follow_type,
              target_id
            });
          }
        } catch (socketErr: any) {
          fastify.log.error(socketErr, 'Failed to emit socket events');
        }
      }

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

      if (!following_username && !target_id) {
        return reply.code(400).send({ error: 'following_username or target_id is required' });
      }

      const follow = await Follow.findOne({
        follower_username: user.username,
        ...(following_username && { following_username }),
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
  fastify.get('/followers', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { following_username, follow_type = 'user', target_id } = query;

      if (!following_username && !target_id) {
        return reply.code(400).send({ error: 'following_username or target_id is required' });
      }

      const { limit, skip } = getPagination(query);

      const filter: any = {
        follow_type,
        ...(following_username && { following_username }),
        ...(target_id && { target_id })
      };

      const followers = await Follow
        .find(filter)
        .sort({ created_at: -1 })
        .limit(limit)
        .skip(skip);

      const total = await Follow.countDocuments(filter);

      reply.send({
        followers,
        pagination: {
          total,
          limit,
          skip,
          hasMore: total > skip + limit
        }
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get following list of a user
  fastify.get('/following', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { follower_username, follow_type } = query;

      if (!follower_username) {
        return reply.code(400).send({ error: 'follower_username is required' });
      }

      const { limit, skip } = getPagination(query);

      const filter: any = { follower_username };
      if (follow_type) filter.follow_type = follow_type;

      const following = await Follow
        .find(filter)
        .sort({ created_at: -1 })
        .limit(limit)
        .skip(skip);

      const total = await Follow.countDocuments(filter);

      reply.send({
        following,
        pagination: {
          total,
          limit,
          skip,
          hasMore: total > skip + limit
        }
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get follow counts for a user/store/community
  fastify.get('/counts', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { following_username, follow_type = 'user', target_id } = query;

      if (!following_username && !target_id) {
        return reply.code(400).send({ error: 'following_username or target_id is required' });
      }

      const filter: any = {
        follow_type,
        ...(following_username && { following_username }),
        ...(target_id && { target_id })
      };

      const followerCount = await Follow.countDocuments(filter);

      // For user follows, also get following count
      let followingCount = 0;
      if (follow_type === 'user' && following_username) {
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
      const user = request.user as any;
      const { follow_type } = query;

      const { limit, skip } = getPagination(query);

      const filter: any = { follower_username: user.username };
      if (follow_type) filter.follow_type = follow_type;

      const following = await Follow
        .find(filter)
        .sort({ created_at: -1 })
        .limit(limit)
        .skip(skip);

      const total = await Follow.countDocuments(filter);

      reply.send({
        following,
        pagination: {
          total,
          limit,
          skip,
          hasMore: total > skip + limit
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
      const user = request.user as any;
      const { follow_type = 'user' } = query;

      const { limit, skip } = getPagination(query);

      const filter: any = {
        following_username: user.username,
        follow_type
      };

      const followers = await Follow
        .find(filter)
        .sort({ created_at: -1 })
        .limit(limit)
        .skip(skip);

      const total = await Follow.countDocuments(filter);

      reply.send({
        followers,
        pagination: {
          total,
          limit,
          skip,
          hasMore: total > skip + limit
        }
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });
}