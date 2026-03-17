import { FastifyInstance } from 'fastify';
import { User, IUser } from '../models/User';
import { z } from 'zod';

export async function userRoutes(fastify: FastifyInstance) {
  // Get user profile by email
  fastify.get('/:email', async (request, reply) => {
    try {
      const { email } = request.params as { email: string };
      const user = await User.findOne({ email }).lean();

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Return public profile info
      return {
        id: user._id,
        email: user.email,
        display_name: user.display_name,
        bio: user.bio,
        avatar_url: user.avatar_url,
        is_verified: user.is_verified,
        created_at: user.created_at,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Search users
  fastify.get('/search', async (request, reply) => {
    try {
      const { q, limit = 10 } = request.query as any;
      if (!q) return [];

      const users = await User.find({
        $or: [
          { email: { $regex: q, $options: 'i' } },
          { display_name: { $regex: q, $options: 'i' } }
        ]
      })
      .limit(parseInt(limit))
      .select('email display_name avatar_url is_verified')
      .lean();

      return users;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
