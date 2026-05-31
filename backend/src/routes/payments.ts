import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { itecPayService } from '../services/itecPayService';
import { Order } from '../models/Order';

const initializePaymentSchema = z.object({
  amount: z.number().min(1).optional(), // Optional since we verify against DB
  email: z.string().email(),
  phone: z.string().optional(),
  order_id: z.string(),
  currency: z.string().optional(),
  // Note: ITEC Pay might not need channels like Paystack does
});

export async function paymentRoutes(fastify: FastifyInstance) {
  // Initialize ITEC Pay payment
  // Note: This is a placeholder implementation. You'll need to adapt this based on
  // how ITEC Pay actually expects payment initialization to work.
  fastify.post('/itecpay/initialize', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { amount: clientAmount, email, phone, order_id, currency } = initializePaymentSchema.parse(request.body);

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

      // TODO: Replace this with actual ITEC Pay initialization logic
      // For now, we'll return a mock response that the frontend can use to redirect
      // to ITEC Pay's payment page. You'll need to implement the actual ITEC Pay
      // payment URL generation based on their documentation.
      
      // Example: Generate a reference for tracking
      const reference = `ITEC_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
      
      // This would be the URL where users should be redirected to pay via ITEC Pay
      // You need to replace this with the actual ITEC Pay payment URL format
      const paymentUrl = `https://itecpay.com/pay?amount=${totalAmount}&reference=${reference}&email=${email}`;
      
      // Return similar structure to Paystack for frontend compatibility
      return {
        status: true,
        message: "Payment initialized",
        data: {
          authorization_url: paymentUrl,
          access_code: "", // ITEC Pay might not use this
          reference: reference,
        }
      };
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

  // ITEC Pay Callback Handler - ITEC sends this to YOUR server
  // Supports: Cards (VISA, Mastercard, American Express)
  // ============================================================
  fastify.post('/itecpay/callback', async (request, reply) => {
    // Extract secret key from query parameters for security
    const { secret } = request.query as { secret?: string };
    
    // Get your secret key from environment variables
    const EXPECTED_SECRET_KEY = process.env.ITEC_PAY_CALLBACK_SECRET || '';
    
    if (!secret || secret !== EXPECTED_SECRET_KEY) {
      return reply.code(401).send({ error: 'Invalid or missing secret key' });
    }

    // Extract callback data from request body
    const { PCODE, amount, transID } = request.body as { 
      PCODE?: string; 
      amount?: string; 
      transID?: string; 
    };

    // Verify the callback has required fields
    if (!PCODE || !amount || !transID) {
      return reply.code(400).send({ 
        error: 'Invalid callback data', 
        details: 'Missing required fields: PCODE, amount, or transID' 
      });
    }

    const callbackData = { PCODE, amount, transID };

    // Verify the callback data (additional verification if needed)
    const isValid = itecPayService.verifyCallback(callbackData, EXPECTED_SECRET_KEY);
    
    if (!isValid) {
      return reply.code(400).send({ error: 'Invalid callback data format' });
    }

    try {
      // Verify the secret key, then update your order/payment status
      await itecPayService.handleSuccessfulPayment(PCODE, transID, amount);
      
      console.log(`✅ ITEC Pay Callback: Payment processed - PCODE: ${PCODE}, transID: ${transID}, amount: ${amount}`);
      
      return reply.code(200).send({ status: 'success' });
     } catch (error: any) {
       fastify.log.error(error);
       return reply.code(500).send({ error: 'Callback processing failed', message: error.message });
     }
  });
}
