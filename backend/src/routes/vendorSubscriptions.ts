import { FastifyInstance } from 'fastify';
import axios from 'axios';
import { VendorSubscription, IVendorSubscription } from '../models/VendorSubscription';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'sk_test_mock_key';

export async function vendorSubscriptionRoutes(fastify: FastifyInstance) {
  // Get subscription for a vendor
  fastify.get('/vendor/:vendorUsername', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { vendorUsername } = request.params as { vendorUsername: string };
      const user = request.user as any;

      // Check if user owns the vendor account
      if (user.username !== vendorUsername.toLowerCase()) {
        return reply.code(403).send({ error: 'You can only view your own subscription' });
      }

      const subscription = await VendorSubscription.findOne({
        vendor_username: vendorUsername.toLowerCase(),
        status: 'active'
      });

      if (!subscription) {
        return reply.code(404).send({ error: 'No active subscription found' });
      }

      reply.send(subscription);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get subscription for a store
  fastify.get('/store/:storeId', async (request, reply) => {
    try {
      const { storeId } = request.params as { storeId: string };

      const subscription = await VendorSubscription.findOne({
        store_id: storeId,
        status: 'active'
      });

      if (!subscription) {
        return reply.code(404).send({ error: 'No active subscription found for this store' });
      }

      reply.send(subscription);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // List vendor subscriptions with filtering
  fastify.get('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const user = request.user as any;
      const {
        vendor_username,
        store_id,
        plan,
        status,
        sort = '-created_at',
        limit = 20,
        skip = 0
      } = query;

      // Check if user owns the vendor account (unless admin)
      if (vendor_username && user.username !== vendor_username.toLowerCase() && user.role !== 'admin') {
        return reply.code(403).send({ error: 'You can only view your own subscriptions' });
      }

      // Build filter object
      const filter: any = {};

      if (vendor_username) {
        filter.vendor_username = vendor_username.toLowerCase();
      } else if (user.role !== 'admin') {
        // Force filter to own username for non-admins
        filter.vendor_username = user.username;
      }
      if (store_id) filter.store_id = store_id;
      if (plan) filter.plan = plan;
      if (status) filter.status = status;

      // Build sort object
      const sortObj: any = {};
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const subscriptions = await VendorSubscription
        .find(filter)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const total = await VendorSubscription.countDocuments(filter);

      reply.send({
        subscriptions,
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

  // Get subscription by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const subscription = await VendorSubscription.findById(id);

      if (!subscription) {
        return reply.code(404).send({ error: 'Vendor subscription not found' });
      }

      reply.send(subscription);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Create vendor subscription
  fastify.post('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const body = request.body as Partial<IVendorSubscription>;
      const user = request.user as any;

      // Validate required fields
      if (!body.plan) {
        return reply.code(400).send({ error: 'Missing required field: plan' });
      }

      // Validate plan
      const validPlans = ['free', 'pro', 'elite'];
      if (!validPlans.includes(body.plan)) {
        return reply.code(400).send({ error: 'Invalid plan. Must be free, pro, or elite' });
      }

      // Set vendor_username from authenticated user
      body.vendor_username = user.username;

      // Set status based on plan
      body.status = body.plan === 'free' ? 'active' : 'pending';
      body.started_at = new Date();

      // Set expiration date based on billing cycle
      if (body.billing_cycle === 'annual') {
        body.expires_at = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
      } else {
        body.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      }

      const subscription = new VendorSubscription(body);
      await subscription.save();

      reply.code(201).send(subscription);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        reply.code(409).send({ error: 'An active subscription already exists for this vendor' });
      } else {
        fastify.log.error(error);
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  });

  // Update vendor subscription
  fastify.put('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Partial<IVendorSubscription>;
      const user = request.user as any;

      const subscription = await VendorSubscription.findById(id);

      if (!subscription) {
        return reply.code(404).send({ error: 'Vendor subscription not found' });
      }

      // Check if user owns the subscription
      if (subscription.vendor_username !== user.username) {
        return reply.code(403).send({ error: 'You can only update your own subscription' });
      }

      // Update allowed fields
      const allowedUpdates = [
        'plan',
        'billing_cycle',
        'custom_domain',
        'payment_method'
      ];

      allowedUpdates.forEach(field => {
        const key = field as keyof IVendorSubscription;
        if (body[key] !== undefined) {
          (subscription as any)[key] = body[key];
        }
      });

      // Validate plan if being updated
      if (body.plan) {
        const validPlans = ['free', 'pro', 'elite'];
        if (!validPlans.includes(body.plan)) {
          return reply.code(400).send({ error: 'Invalid plan. Must be free, pro, or elite' });
        }
        
        // If switching from free to paid or upgrading, set to pending
        if (body.plan !== 'free' && subscription.plan !== body.plan) {
          subscription.status = 'pending';
        } else if (body.plan === 'free') {
          subscription.status = 'active';
        }
      }

      // Update expiration if billing cycle changed
      if (body.billing_cycle) {
        const currentExpiry = subscription.expires_at && subscription.expires_at > new Date() 
          ? subscription.expires_at 
          : new Date();
          
        if (body.billing_cycle === 'annual') {
          subscription.expires_at = new Date(currentExpiry.getTime() + 365 * 24 * 60 * 60 * 1000);
        } else {
          subscription.expires_at = new Date(currentExpiry.getTime() + 30 * 24 * 60 * 60 * 1000);
        }
      }

      await subscription.save();

      reply.send(subscription);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        reply.code(409).send({ error: 'Custom domain is already in use' });
      } else {
        fastify.log.error(error);
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  });

  // Cancel subscription
  fastify.post('/:id/cancel', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const subscription = await VendorSubscription.findById(id);

      if (!subscription) {
        return reply.code(404).send({ error: 'Vendor subscription not found' });
      }

      // Check if user owns the subscription
      if (subscription.vendor_username !== user.username) {
        return reply.code(403).send({ error: 'You can only cancel your own subscription' });
      }

      subscription.status = 'cancelled';
      await subscription.save();

      reply.send(subscription);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Renew subscription
  fastify.post('/:id/renew', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const subscription = await VendorSubscription.findById(id);

      if (!subscription) {
        return reply.code(404).send({ error: 'Vendor subscription not found' });
      }

      // Check if user owns the subscription
      if (subscription.vendor_username !== user.username) {
        return reply.code(403).send({ error: 'You can only renew your own subscription' });
      }

      // Calculate new expiration date
      const currentExpiry = subscription.expires_at || new Date();
      let newExpiry: Date;

      if (subscription.billing_cycle === 'annual') {
        newExpiry = new Date(currentExpiry.getTime() + 365 * 24 * 60 * 60 * 1000);
      } else {
        newExpiry = new Date(currentExpiry.getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      subscription.expires_at = newExpiry;
      subscription.status = 'active';
      await subscription.save();

      reply.send(subscription);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete subscription
  fastify.delete('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const subscription = await VendorSubscription.findById(id);

      if (!subscription) {
        return reply.code(404).send({ error: 'Vendor subscription not found' });
      }

      // Check if user owns the subscription
      if (subscription.vendor_username !== user.username) {
        return reply.code(403).send({ error: 'You can only delete your own subscription' });
      }

      await VendorSubscription.findByIdAndDelete(id);

      reply.send({ message: 'Vendor subscription deleted successfully' });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Check subscription status
  fastify.get('/:id/status', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const subscription = await VendorSubscription.findById(id);

      if (!subscription) {
        return reply.code(404).send({ error: 'Vendor subscription not found' });
      }

      const now = new Date();
      let currentStatus = subscription.status;

      // Check if subscription has expired
      if (subscription.expires_at && subscription.expires_at < now && subscription.status === 'active') {
        currentStatus = 'expired';
        // Update the status in database
        subscription.status = 'expired';
        await subscription.save();
      }

      const daysUntilExpiry = subscription.expires_at
        ? Math.ceil((subscription.expires_at.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      reply.send({
        subscription_id: id,
        plan: subscription.plan,
        status: currentStatus,
        billing_cycle: subscription.billing_cycle,
        expires_at: subscription.expires_at,
        days_until_expiry: daysUntilExpiry,
        is_expired: currentStatus === 'expired',
        custom_domain: subscription.custom_domain
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get subscription plans and pricing (public endpoint)
  fastify.get('/public/plans', async (request, reply) => {
    try {
      const plans = {
        free: {
          name: 'Free',
          price_monthly: 0,
          price_annual: 0,
          features: [
            'Up to 10 products',
            'Basic analytics',
            'Community support'
          ]
        },
        pro: {
          name: 'Pro',
          price_monthly: 29,
          price_annual: 276,
          features: [
            'Unlimited products',
            'Advanced analytics',
            'Priority support',
            'Custom domain',
            'AI-powered insights'
          ]
        },
        elite: {
          name: 'Elite',
          price_monthly: 79,
          price_annual: 756,
          features: [
            'All Pro features',
            'White-label solution',
            'Dedicated account manager',
            'API access',
            'Custom integrations'
          ]
        }
      };

      reply.send({ plans });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Verify payment for a subscription
  fastify.post('/:id/verify-payment', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { reference } = request.body as { reference: string };
      const user = request.user as any;

      if (!reference) {
        return reply.code(400).send({ error: 'Missing payment reference' });
      }

      const subscription = await VendorSubscription.findById(id);

      if (!subscription) {
        return reply.code(404).send({ error: 'Subscription not found' });
      }

      // Check ownership
      if (subscription.vendor_username !== user.username) {
        return reply.code(403).send({ error: 'You can only verify your own subscription' });
      }

      // Actual Paystack API verification
      try {
        const response = await axios.get(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
          {
            headers: {
              Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            },
          }
        );

        const data = response.data.data;
        if (data.status !== 'success') {
          return reply.code(402).send({ error: 'Payment verification failed' });
        }

        // Verify amount matches plan price
        const prices: Record<string, Record<string, number>> = {
          pro: { monthly: 29, annual: 276 },
          elite: { monthly: 79, annual: 756 }
        };

        const planPrice = prices[subscription.plan]?.[subscription.billing_cycle || 'monthly'] || 0;
        // Paystack amount is in kobo (kobo = price * 100)
        if (data.amount < planPrice * 100) {
          return reply.code(402).send({ error: 'Payment amount mismatch. Incorrect price paid.' });
        }
        
        subscription.status = 'active';
        subscription.payment_reference = reference;
        subscription.last_payment_date = new Date();
        
        // Recalculate expiration from today
        const now = new Date();
        if (subscription.billing_cycle === 'annual') {
          subscription.expires_at = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
        } else {
          subscription.expires_at = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        }

        await subscription.save();

        reply.send(subscription);
      } catch (paystackError) {
        fastify.log.error(paystackError);
        return reply.code(402).send({ error: 'Failed to verify with Paystack' });
      }
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });
}