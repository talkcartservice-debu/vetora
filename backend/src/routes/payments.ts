import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { itechpayService } from '../services/itechpayService';
import { Order } from '../models/Order';

const VALID_CHANNELS = ['card', 'mtn', 'airtel', 'mobile_money'] as const;

const initializePaymentSchema = z.object({
  amount: z.number().min(1).optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  order_id: z.string(),
  channel: z.enum(VALID_CHANNELS).optional(),
});

export async function paymentRoutes(fastify: FastifyInstance) {
  // Initialize iTechPay payment
  fastify.post('/itechpay/initialize', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { amount: clientAmount, email, phone, order_id, channel } = initializePaymentSchema.parse(request.body);

      let totalAmount: number;

      const isSubscriptionPayment = order_id.split(',').every(id => id.trim().startsWith('SUB-'));

      if (isSubscriptionPayment) {
        if (!clientAmount || clientAmount <= 0) {
          return reply.code(400).send({ error: 'Amount is required for subscription payments' });
        }
        totalAmount = clientAmount;
      } else {
        const orderIds = order_id.split(',').map(id => id.trim());
        const orders = await Order.find({ _id: { $in: orderIds } });

        if (orders.length === 0) {
          return reply.code(404).send({ error: 'Orders not found' });
        }

        totalAmount = orders.reduce((sum, order) => sum + order.total, 0);
      }

      const data = await itechpayService.initializeTransaction(email, totalAmount, order_id, channel || 'card', phone);
      return data;
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      const statusCode = error.statusCode || 500;
      return reply.code(statusCode).send({ 
        error: 'Failed to initialize payment', 
        message: error.message,
        details: error.details 
      });
    }
  });

  // Verify iTechPay payment
  fastify.get('/itechpay/verify/:reference', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { reference } = request.params as { reference: string };

    try {
      const data = await itechpayService.verifyTransaction(reference);
      return data;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to verify payment', message: error.message });
    }
  });

  // iTechPay Callback
  fastify.post('/itechpay/callback', async (request, reply) => {
    const { secret } = request.query as { secret?: string };

    if (!secret) {
      return reply.code(401).send({ error: 'Missing callback secret' });
    }

    const isValid = itechpayService.verifyCallbackSecret(secret);

    if (!isValid) {
      return reply.code(401).send({ error: 'Invalid callback secret' });
    }

    const body = request.body as any;

    try {
      const { PCODE, amount, transID } = body;

      if (!PCODE || !transID) {
        return reply.code(400).send({ error: 'Missing required callback fields: PCODE, transID' });
      }

      // Look up the order by payment reference (PCODE was stored as reference)
      const orders = await Order.find({ payment_reference: PCODE, payment_status: { $ne: 'paid' } });

      if (orders.length > 0) {
        const orderIds = orders.map(o => o._id.toString()).join(',');
        await itechpayService.handleSuccessfulPayment(orderIds, transID);
        console.log(`✅ Callback: Payment success for PCODE ${PCODE}, transID ${transID}, amount ${amount}`);
      }

      return reply.code(200).send({ status: 'success' });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Callback processing failed' });
    }
  });
}
