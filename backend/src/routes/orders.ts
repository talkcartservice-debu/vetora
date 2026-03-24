import { FastifyInstance } from 'fastify';
import { Order, IOrder } from '../models/Order';
import { Product } from '../models/Product';
import { z } from 'zod';

const createOrderSchema = z.object({
  buyer_email: z.string().email(),
  items: z.array(z.object({
    product_id: z.string(),
    product_title: z.string(),
    product_image: z.string().optional(),
    quantity: z.number().min(1),
    price: z.number().min(0),
  })),
  subtotal: z.number().min(0),
  shipping_fee: z.number().default(0),
  total: z.number().min(0),
  shipping_address: z.string().optional(),
  order_note: z.string().optional(),
  affiliate_email: z.string().email().or(z.literal('')).optional(),
  payment_method: z.enum(['card', 'paypal', 'crypto', 'bank_transfer', 'paystack']).default('paystack'),
});

export async function orderRoutes(fastify: FastifyInstance) {
  // List orders for a user
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const { role = 'buyer', status, limit = 20, skip = 0 } = request.query as any;

      const filter: any = {};
      if (role === 'buyer') {
        filter.buyer_email = user.email;
      } else {
        filter.vendor_email = user.email;
      }

      if (status) filter.status = status;

      const orders = await Order.find(filter)
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .lean();

      const total = await Order.countDocuments(filter);

      return {
        data: orders,
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

  // Get order by ID
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const order = await Order.findById(id).lean();

      if (!order) {
        return reply.code(404).send({ error: 'Order not found' });
      }

      // Check permissions
      if (order.buyer_email !== user.email && order.vendor_email !== user.email) {
        return reply.code(403).send({ error: 'Unauthorized' });
      }

      return order;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Create order
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const body = createOrderSchema.parse(request.body);

      // Get vendor_email and store_id from the first product
      const firstProduct = await Product.findById(body.items[0].product_id);
      if (!firstProduct) {
        return reply.code(400).send({ error: 'Invalid product' });
      }

      const order = new Order({
        ...body,
        buyer_email: user.email,
        vendor_email: firstProduct.vendor_email,
        store_id: firstProduct.store_id,
        store_name: firstProduct.store_name,
        order_note: body.order_note,
        affiliate_email: body.affiliate_email || undefined,
        status: 'pending',
        payment_status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      });

      await order.save();
      
      // Update product sales count and inventory
      for (const item of body.items) {
        await Product.findByIdAndUpdate(item.product_id, {
          $inc: { 
            sales_count: item.quantity,
            inventory_count: -item.quantity
          }
        });
      }

      return order;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update order status
  fastify.patch('/:id/status', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { status } = request.body as { status: string };
      const user = request.user as any;

      const order = await Order.findById(id);
      if (!order) {
        return reply.code(404).send({ error: 'Order not found' });
      }

      // Only vendor can update status to confirmed, processing, shipped, delivered
      if (order.vendor_email !== user.email && status !== 'cancelled') {
        return reply.code(403).send({ error: 'Unauthorized' });
      }

      // Only buyer can update status to cancelled if it's still pending
      if (order.buyer_email === user.email && status === 'cancelled' && order.status !== 'pending') {
        return reply.code(400).send({ error: 'Cannot cancel order after it has been confirmed' });
      }

      order.status = status as any;
      order.updated_at = new Date();
      await order.save();

      return order;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });
}