import { FastifyRequest, FastifyReply } from 'fastify';
import { VendorSubscription } from '../models/VendorSubscription';
import { Product } from '../models/Product';

export const PLAN_LIMITS = {
  free: { 
    products: 10, 
    images_per_product: 5,
    custom_domain: false,
    shipping_zones: false,
    affiliate_program: false
  },
  pro: { 
    products: 200, 
    images_per_product: 20,
    custom_domain: true,
    shipping_zones: true,
    affiliate_program: false
  },
  elite: { 
    products: Infinity, 
    images_per_product: Infinity,
    custom_domain: true,
    shipping_zones: true,
    affiliate_program: true
  }
};

/**
 * Helper to get the active plan and its limits for a vendor
 */
async function getVendorPlan(username: string) {
  const normalizedUsername = username.toLowerCase();
  
  // Find active subscription
  const subscription = await VendorSubscription.findOne({
    vendor_username: normalizedUsername,
    status: 'active'
  });

  const plan = subscription?.plan || 'free';
  return {
    plan,
    limits: PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS],
    normalizedUsername
  };
}

/**
 * Middleware to check if a vendor can create more products
 */
export async function checkProductCountLimit(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as any;
    if (!user?.username) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { plan, limits, normalizedUsername } = await getVendorPlan(user.username);

    // Count existing products (exclude archived)
    const productCount = await Product.countDocuments({
      vendor_username: normalizedUsername,
      status: { $ne: 'archived' }
    });

    if (productCount >= limits.products) {
      const limitDisplay = limits.products === Infinity ? 'unlimited' : limits.products;
      return reply.code(403).send({ 
        error: 'Subscription limit reached', 
        message: `Your ${plan} plan allows up to ${limitDisplay} products. Please upgrade to add more.`,
        limit: limits.products,
        current: productCount
      });
    }
  } catch (err: any) {
    reply.log.error(err);
    return reply.code(500).send({ error: 'Internal server error during limit check' });
  }
}

/**
 * Middleware to check if a vendor has too many media files in a product
 */
export async function checkProductMediaLimit(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as any;
    if (!user?.username) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { plan, limits } = await getVendorPlan(user.username);

    // Check images/videos limit in body
    const body = request.body as any;
    if (!body) return; // No body, nothing to check

    const imagesCount = (body.images?.length || 0) + (body.videos?.length || 0);
    
    if (imagesCount > limits.images_per_product) {
       const limitDisplay = limits.images_per_product === Infinity ? 'unlimited' : limits.images_per_product;
       return reply.code(403).send({ 
        error: 'Subscription limit reached', 
        message: `Your ${plan} plan allows up to ${limitDisplay} media files per product. Please upgrade to add more.`,
        limit: limits.images_per_product,
        current: imagesCount
      });
    }
  } catch (err: any) {
    reply.log.error(err);
    return reply.code(500).send({ error: 'Internal server error during limit check' });
  }
}

/**
 * Middleware to check if a vendor can use custom domains
 */
export async function checkCustomDomainLimit(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as any;
    if (!user?.username) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const body = request.body as any;
    // Only check if custom_domain is being set
    if (!body?.custom_domain) return;

    const { plan, limits } = await getVendorPlan(user.username);

    if (!limits.custom_domain) {
      return reply.code(403).send({ 
        error: 'Subscription feature restricted', 
        message: `Custom domains are not available on the ${plan} plan. Please upgrade to Pro or Elite.`
      });
    }
  } catch (err: any) {
    reply.log.error(err);
    return reply.code(500).send({ error: 'Internal server error during limit check' });
  }
}

/**
 * Middleware to check if a vendor can use shipping zones
 */
export async function checkShippingZoneLimit(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as any;
    if (!user?.username) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { plan, limits } = await getVendorPlan(user.username);

    if (!limits.shipping_zones) {
      return reply.code(403).send({ 
        error: 'Subscription feature restricted', 
        message: `Shipping zones are not available on the ${plan} plan. Please upgrade to Pro or Elite.`
      });
    }
  } catch (err: any) {
    reply.log.error(err);
    return reply.code(500).send({ error: 'Internal server error during limit check' });
  }
}
