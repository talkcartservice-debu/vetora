import { FastifyInstance } from 'fastify';
import { Bookmark, IBookmark } from '../models/Bookmark';
import { Post } from '../models/Post';
import { Product } from '../models/Product';

export async function bookmarkRoutes(fastify: FastifyInstance) {
  // List bookmarks for current user
  fastify.get('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const { target_type, limit = 50, skip = 0 } = request.query as any;

      const filter: any = { user_email: user.email };
      if (target_type) filter.target_type = target_type;

      const bookmarks = await Bookmark
        .find(filter)
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .lean();

      const total = await Bookmark.countDocuments(filter);

      reply.send({
        data: bookmarks,
        total,
        limit: parseInt(limit),
        skip: parseInt(skip)
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Check if bookmarked
  fastify.get('/check', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const { target_type, target_id } = request.query as any;

      if (!target_type || !target_id) {
        return reply.code(400).send({ error: 'Missing target_type or target_id' });
      }

      const bookmark = await Bookmark.findOne({
        user_email: user.email,
        target_type,
        target_id
      });

      reply.send({ is_bookmarked: !!bookmark });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Create bookmark
  fastify.post('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const { target_type, target_id } = request.body as { target_type: string, target_id: string };

      if (!target_type || !target_id) {
        return reply.code(400).send({ error: 'Missing target_type or target_id' });
      }

      // Check if already bookmarked
      const existing = await Bookmark.findOne({
        user_email: user.email,
        target_type,
        target_id
      });

      if (existing) {
        return reply.code(409).send({ error: 'Already bookmarked' });
      }

      const bookmark = new Bookmark({
        user_email: user.email,
        target_type,
        target_id
      });

      await bookmark.save();
      reply.code(201).send(bookmark);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Remove bookmark
  fastify.delete('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const { target_type, target_id } = request.query as any;

      if (!target_type || !target_id) {
        return reply.code(400).send({ error: 'Missing target_type or target_id' });
      }

      const result = await Bookmark.findOneAndDelete({
        user_email: user.email,
        target_type,
        target_id
      });

      if (!result) {
        return reply.code(404).send({ error: 'Bookmark not found' });
      }

      reply.send({ message: 'Bookmark removed' });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
