import { FastifyInstance } from 'fastify';
import { Community, ICommunity } from '../models/Community';
import { User } from '../models/User';

export async function communityRoutes(fastify: FastifyInstance) {
  // List communities with filtering and search
  fastify.get('/', async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        category,
        owner_email,
        is_public = true,
        search,
        sort = '-member_count',
        limit = 20,
        skip = 0
      } = query;

      // Build filter object
      const filter: any = {};

      if (category) filter.category = category;
      if (owner_email) filter.owner_email = owner_email;
      if (is_public !== undefined) filter.is_public = is_public === 'true';

      // Text search
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      // Build sort object
      const sortObj: any = {};
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const communities = await Community
        .find(filter)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .populate('owner_email', 'display_name avatar_url');

      const total = await Community.countDocuments(filter);

      reply.send({
        communities,
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

  // Get community by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const community = await Community.findById(id)
        .populate('owner_email', 'display_name avatar_url');

      if (!community) {
        return reply.code(404).send({ error: 'Community not found' });
      }

      reply.send(community);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get community by name
  fastify.get('/name/:name', async (request, reply) => {
    try {
      const { name } = request.params as { name: string };

      const community = await Community.findOne({ name: name.toLowerCase() })
        .populate('owner_email', 'display_name avatar_url');

      if (!community) {
        return reply.code(404).send({ error: 'Community not found' });
      }

      reply.send(community);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Create community
  fastify.post('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const body = request.body as Partial<ICommunity>;
      const user = request.user as any;

      // Validate required fields
      if (!body.name) {
        return reply.code(400).send({ error: 'Missing required field: name' });
      }

      // Check if community name is already taken
      const existingCommunity = await Community.findOne({
        name: { $regex: new RegExp(`^${body.name}$`, 'i') }
      });

      if (existingCommunity) {
        return reply.code(409).send({ error: 'Community name already exists' });
      }

      const community = new Community({
        ...body,
        name: body.name.toLowerCase(),
        owner_email: user.email,
        member_count: 1, // Owner is automatically a member
      });

      await community.save();

      // TODO: Add owner as first member in CommunityMember collection

      // Emit real-time event
      fastify.io?.emit('community:created', {
        community: community.toObject()
      });

      reply.code(201).send(community);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update community
  fastify.put('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Partial<ICommunity>;
      const user = request.user as any;

      const community = await Community.findById(id);

      if (!community) {
        return reply.code(404).send({ error: 'Community not found' });
      }

      // Check if user is the owner
      if (community.owner_email !== user.email) {
        return reply.code(403).send({ error: 'You can only update communities you own' });
      }

      // Prevent name changes
      if (body.name && body.name.toLowerCase() !== community.name) {
        return reply.code(400).send({ error: 'Community name cannot be changed' });
      }

      // Update allowed fields
      const allowedUpdates = ['description', 'cover_image', 'icon_url', 'category', 'featured_products', 'rules', 'is_public'];
      allowedUpdates.forEach(field => {
        const key = field as keyof ICommunity;
        if (body[key] !== undefined) {
          (community as any)[key] = body[key];
        }
      });

      await community.save();

      // Emit real-time event
      fastify.io?.emit('community:updated', {
        community: community.toObject()
      });

      reply.send(community);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete community
  fastify.delete('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const community = await Community.findById(id);

      if (!community) {
        return reply.code(404).send({ error: 'Community not found' });
      }

      // Check if user is the owner
      if (community.owner_email !== user.email) {
        return reply.code(403).send({ error: 'You can only delete communities you own' });
      }

      await Community.findByIdAndDelete(id);

      // TODO: Clean up related data (posts, members, etc.)

      // Emit real-time event
      fastify.io?.emit('community:deleted', {
        community_id: id
      });

      reply.send({ message: 'Community deleted successfully' });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get user's communities
  fastify.get('/user/me', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { role = 'owner', limit = 20, skip = 0 } = query; // role can be 'owner' or 'member'
      const user = request.user as any;

      let filter: any = {};

      if (role === 'owner') {
        filter.owner_email = user.email;
      } else {
        // TODO: Implement member lookup when CommunityMember model is ready
        filter.owner_email = user.email; // Temporary fallback
      }

      const communities = await Community
        .find(filter)
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const total = await Community.countDocuments(filter);

      reply.send({
        communities,
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

  // Join community
  fastify.post('/:id/join', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const community = await Community.findById(id);

      if (!community) {
        return reply.code(404).send({ error: 'Community not found' });
      }

      if (!community.is_public) {
        return reply.code(403).send({ error: 'This community is private' });
      }

      // TODO: Check if user is already a member
      // TODO: Add user to CommunityMember collection
      // For now, just increment member count
      community.member_count += 1;
      await community.save();

      // Emit real-time event
      fastify.io?.emit('community:joined', {
        community_id: id,
        user_email: user.email,
        member_count: community.member_count
      });

      reply.send({ message: 'Successfully joined community' });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Leave community
  fastify.post('/:id/leave', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const community = await Community.findById(id);

      if (!community) {
        return reply.code(404).send({ error: 'Community not found' });
      }

      // Prevent owner from leaving
      if (community.owner_email === user.email) {
        return reply.code(400).send({ error: 'Community owner cannot leave the community' });
      }

      // TODO: Check if user is a member
      // TODO: Remove user from CommunityMember collection
      // For now, just decrement member count
      if (community.member_count > 0) {
        community.member_count -= 1;
        await community.save();
      }

      // Emit real-time event
      fastify.io?.emit('community:left', {
        community_id: id,
        user_email: user.email,
        member_count: community.member_count
      });

      reply.send({ message: 'Successfully left community' });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });
}