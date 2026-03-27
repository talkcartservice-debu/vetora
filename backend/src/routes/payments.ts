import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { paystackService } from '../services/paystackService';

const initializePaymentSchema = z.object({
  amount: z.number().min(1), // Total amount in NGN/USD
  email: z.string().email(),
  order_id: z.string(),
  currency: z.string().default('NGN'),
});

export async function paymentRoutes(fastify: FastifyInstance) {
  // Initialize Paystack payment
  fastify.post('/paystack/initialize', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { amount, email, order_id, currency } = initializePaymentSchema.parse(request.body);
      const data = await paystackService.initializeTransaction(email, amount, order_id, currency);
      return data;
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to initialize payment', message: error.message });
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
