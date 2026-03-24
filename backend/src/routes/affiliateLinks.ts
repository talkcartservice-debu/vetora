import { FastifyInstance } from 'fastify';
import { AffiliateLink, IAffiliateLink } from '../models/AffiliateLink';
import { Product } from '../models/Product';
import { User } from '../models/User';

export async function affiliateLinkRoutes(fastify: FastifyInstance) {
  // List affiliate links with filtering
  fastify.get('/', async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        influencer_email,
        store_id,
        product_id,
        status = 'active',
        sort = '-created_at',
        limit = 20,
        skip = 0
      } = query;

      // Build filter object
      const filter: any = {};

      if (influencer_email) filter.influencer_email = influencer_email;
      if (store_id) filter.store_id = store_id;
      if (product_id) filter.product_id = product_id;
      if (status) filter.status = status;

      // Build sort object
      const sortObj: any = {};
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const links = await AffiliateLink
        .find(filter)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      // product_id and store_id are strings, so we can't use .populate()
      // If we need product/store info, we would need to fetch it separately.

      const total = await AffiliateLink.countDocuments(filter);

      reply.send({
        links,
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

  // Get affiliate link by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const link = await AffiliateLink.findById(id);

      if (!link) {
        return reply.code(404).send({ error: 'Affiliate link not found' });
      }

      reply.send(link);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get affiliate link by ref code
  fastify.get('/ref/:refCode', async (request, reply) => {
    try {
      const { refCode } = request.params as { refCode: string };

      const link = await AffiliateLink.findOne({
        ref_code: refCode.toUpperCase(),
        status: 'active'
      });

      if (!link) {
        return reply.code(404).send({ error: 'Affiliate link not found or inactive' });
      }

      reply.send(link);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Create affiliate link
  fastify.post('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const body = request.body as Partial<IAffiliateLink>;
      const user = request.user as any;

      // Validate required fields
      if (!body.product_id) {
        return reply.code(400).send({ error: 'Missing required field: product_id' });
      }

      // Check if product exists
      const product = await Product.findById(body.product_id);
      if (!product) {
        return reply.code(404).send({ error: 'Product not found' });
      }

      // Generate unique ref code
      const refCode = generateRefCode();

      const link = new AffiliateLink({
        ...body,
        influencer_email: user.email,
        influencer_name: user.name || user.email,
        store_id: product.store_id,
        store_name: product.store_name,
        product_title: product.title,
        product_price: product.price,
        ref_code: refCode,
      });

      await link.save();

      reply.code(201).send(link);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Update affiliate link
  fastify.put('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Partial<IAffiliateLink>;
      const user = request.user as any;

      const link = await AffiliateLink.findById(id);

      if (!link) {
        return reply.code(404).send({ error: 'Affiliate link not found' });
      }

      // Check if user owns the link
      if (link.influencer_email !== user.email) {
        return reply.code(403).send({ error: 'You can only update your own affiliate links' });
      }

      // Prevent updating ref_code
      if (body.ref_code && body.ref_code !== link.ref_code) {
        return reply.code(400).send({ error: 'Cannot change referral code' });
      }

      // Update allowed fields
      const allowedUpdates = ['commission_pct', 'status'];
      allowedUpdates.forEach(field => {
        const key = field as keyof IAffiliateLink;
        if (body[key] !== undefined) {
          (link as any)[key] = body[key];
        }
      });

      await link.save();

      reply.send(link);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Delete affiliate link
  fastify.delete('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const link = await AffiliateLink.findById(id);

      if (!link) {
        return reply.code(404).send({ error: 'Affiliate link not found' });
      }

      // Check if user owns the link
      if (link.influencer_email !== user.email) {
        return reply.code(403).send({ error: 'You can only delete your own affiliate links' });
      }

      await AffiliateLink.findByIdAndDelete(id);

      reply.send({ message: 'Affiliate link deleted successfully' });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Track click on affiliate link
  fastify.post('/ref/:refCode/click', async (request, reply) => {
    try {
      const { refCode } = request.params as { refCode: string };

      const link = await AffiliateLink.findOneAndUpdate(
        { ref_code: refCode.toUpperCase(), status: 'active' },
        { $inc: { clicks: 1 } },
        { new: true }
      );

      if (!link) {
        return reply.code(404).send({ error: 'Affiliate link not found or inactive' });
      }

      reply.send({
        message: 'Click tracked successfully',
        clicks: link.clicks
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Track conversion on affiliate link
  fastify.post('/ref/:refCode/convert', async (request, reply) => {
    try {
      const { refCode } = request.params as { refCode: string };
      const body = request.body as { commission_amount: number };

      const link = await AffiliateLink.findOne({
        ref_code: refCode.toUpperCase(),
        status: 'active'
      });

      if (!link) {
        return reply.code(404).send({ error: 'Affiliate link not found or inactive' });
      }

      // Calculate commission
      const commissionAmount = body.commission_amount || 0;

      // Update link stats
      link.conversions += 1;
      link.total_commission_earned += commissionAmount;
      await link.save();

      reply.send({
        message: 'Conversion tracked successfully',
        conversions: link.conversions,
        total_commission_earned: link.total_commission_earned
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get influencer's affiliate links
  fastify.get('/influencer/me', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { status, limit = 20, skip = 0 } = query;
      const user = request.user as any;

      const filter: any = { influencer_email: user.email };
      if (status) filter.status = status;

      const links = await AffiliateLink
        .find(filter)
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const total = await AffiliateLink.countDocuments(filter);

      // Calculate totals
      const stats = await AffiliateLink.aggregate([
        { $match: { influencer_email: user.email } },
        {
          $group: {
            _id: null,
            total_clicks: { $sum: '$clicks' },
            total_conversions: { $sum: '$conversions' },
            total_earned: { $sum: '$total_commission_earned' },
            total_paid: { $sum: '$commission_paid' }
          }
        }
      ]);

      reply.send({
        links,
        stats: stats[0] || {
          total_clicks: 0,
          total_conversions: 0,
          total_earned: 0,
          total_paid: 0
        },
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

  // Get affiliate links for a product
  fastify.get('/product/:productId', async (request, reply) => {
    try {
      const { productId } = request.params as { productId: string };
      const query = request.query as any;
      const { status = 'active', limit = 10, skip = 0 } = query;

      const filter: any = { product_id: productId, status };

      const links = await AffiliateLink
        .find(filter)
        .sort({ clicks: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      // influencer_email is a string, so we can't use .populate()
      // If we need influencer info, we would need to fetch it separately by email.

      const total = await AffiliateLink.countDocuments(filter);

      reply.send({
        links,
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
}

// Helper function to generate unique referral code
function generateRefCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}