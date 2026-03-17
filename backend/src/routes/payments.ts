import { FastifyInstance } from 'fastify';
import axios from 'axios';
import { z } from 'zod';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'sk_test_mock_key';

const initializePaymentSchema = z.object({
  amount: z.number().min(1), // In kobo (Paystack uses kobo for NGN)
  email: z.string().email(),
  order_id: z.string(),
  currency: z.string().default('NGN'),
});

export async function paymentRoutes(fastify: FastifyInstance) {
  // Initialize Paystack payment
  fastify.post('/initialize', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { amount, email, order_id, currency } = initializePaymentSchema.parse(request.body);

      const response = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        {
          amount,
          email,
          currency,
          metadata: {
            order_id,
            custom_fields: [
              {
                display_name: "Order ID",
                variable_name: "order_id",
                value: order_id
              }
            ]
          },
        },
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      if (axios.isAxiosError(error)) {
        fastify.log.error(error.response?.data || error.message);
        return reply.code(error.response?.status || 500).send({ 
          error: 'Paystack Error', 
          message: error.response?.data?.message || 'Failed to initialize payment' 
        });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Verify Paystack payment
  fastify.get('/verify/:reference', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { reference } = request.params as { reference: string };

    try {
      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      const data = response.data.data;
      if (data.status === 'success') {
        const orderId = data.metadata.order_id;
        // Update order status to paid in database
        // TODO: Update order model
        console.log(`💰 Payment verified for order ${orderId}`);
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        fastify.log.error(error.response?.data || error.message);
        return reply.code(error.response?.status || 500).send({ 
          error: 'Paystack Verification Error', 
          message: error.response?.data?.message || 'Failed to verify payment' 
        });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Paystack Webhook
  fastify.post('/webhook', async (request, reply) => {
    // In production, verify signature
    // const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(JSON.stringify(request.body)).digest('hex');
    // if (hash !== request.headers['x-paystack-signature']) return reply.code(401).send();

    const event = request.body as any;

    try {
      if (event.event === 'charge.success') {
        const data = event.data;
        const orderId = data.metadata.order_id;
        
        // Update order status in database
        console.log(`✅ Webhook: Payment success for order ${orderId}`);
      }

      return reply.code(200).send();
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send();
    }
  });
}