import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { paystackService } from '../services/paystackService';
import { Order } from '../models/Order';

const VALID_PAYSTACK_CHANNELS = ['card', 'bank', 'ussd', 'mobile_money', 'bank_transfer', 'qr'] as const;

const initializePaymentSchema = z.object({
  amount: z.number().min(1).optional(), // Optional since we verify against DB
  email: z.string().email(),
  phone: z.string().optional(),
  order_id: z.string(),
  currency: z.string().optional(),
  channels: z.array(z.enum(VALID_PAYSTACK_CHANNELS)).optional(),
});

export async function paymentRoutes(fastify: FastifyInstance) {
  // Initialize Paystack payment
  fastify.post('/paystack/initialize', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { amount: clientAmount, email, phone, order_id, currency, channels } = initializePaymentSchema.parse(request.body);

      let totalAmount: number;

      // Subscription payments use a "SUB-" prefixed ID and don't map to Order documents
      const isSubscriptionPayment = order_id.split(',').every(id => id.trim().startsWith('SUB-'));

      if (isSubscriptionPayment) {
        if (!clientAmount || clientAmount <= 0) {
          return reply.code(400).send({ error: 'Amount is required for subscription payments' });
        }
        totalAmount = clientAmount;
      } else {
        // Calculate total from all orders (comma-separated IDs)
        const orderIds = order_id.split(',').map(id => id.trim());
        const orders = await Order.find({ _id: { $in: orderIds } });

        if (orders.length === 0) {
          return reply.code(404).send({ error: 'Orders not found' });
        }

        totalAmount = orders.reduce((sum, order) => sum + order.total, 0);
      }

      // Use the server-side total amount
      const data = await paystackService.initializeTransaction(email, totalAmount, order_id, currency, channels, phone);
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

  // Verify Paystack payment
  fastify.get('/paystack/verify/:reference', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { reference } = request.params as { reference: string };

    try {
      const data = await paystackService.verifyTransaction(reference);
      return data;
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to verify payment', message: error.message });
    }
  });

  // Paystack Webhook
  fastify.post('/paystack/webhook', async (request, reply) => {
    const signature = request.headers['x-paystack-signature'] as string;
    
    if (!signature) {
      return reply.code(401).send({ error: 'Missing Paystack signature' });
    }

    const isValid = paystackService.verifyWebhookSignature(request.body, signature);
    
    if (!isValid) {
      return reply.code(401).send({ error: 'Invalid Paystack signature' });
    }

    const event = request.body as any;

    try {
      if (event.event === 'charge.success') {
        const data = event.data;
        const orderId = data.metadata.order_id;
        const reference = data.reference;
        
        await paystackService.handleSuccessfulPayment(orderId, reference);
        console.log(`✅ Webhook: Payment success for order ${orderId}`);
      }

      return reply.code(200).send({ status: 'success' });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Webhook processing failed' });
    }
  });
}
