import axios from 'axios';
import crypto from 'crypto';
import { Order } from '../models/Order';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';

export interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export const paystackService = {
  /**
   * Initialize a Paystack transaction
   */
  async initializeTransaction(email: string, amount: number, orderId: string, currency: string = 'NGN'): Promise<PaystackInitializeResponse> {
    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY === 'your_paystack_secret_key') {
      throw new Error('Paystack secret key is not configured. Please check your environment variables.');
    }
    try {
      const response = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        {
          amount: Math.round(amount * 100), // Convert to kobo/cents
          email,
          currency,
          metadata: {
            order_id: orderId,
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
    } catch (error: any) {
      const errorData = error.response?.data;
      console.error('Paystack Initialization Error:', errorData || error.message);
      
      let errorMessage = errorData?.message || error.message || 'Failed to initialize Paystack transaction';
      
      if (error.response?.status === 401) {
        errorMessage = 'Paystack authentication failed. Please check if your PAYSTACK_SECRET_KEY is valid.';
      }

      const newError: any = new Error(errorMessage);
      newError.details = errorData;
      newError.statusCode = error.response?.status || 500;
      throw newError;
    }
  },

  /**
   * Verify a Paystack transaction
   */
  async verifyTransaction(reference: string) {
    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY === 'your_paystack_secret_key') {
      throw new Error('Paystack secret key is not configured. Please check your environment variables.');
    }
    try {
      const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      });

      const { data } = response.data;
      
      if (data.status === 'success') {
        const orderId = data.metadata.order_id;
        await this.handleSuccessfulPayment(orderId, reference);
      }

      return response.data;
    } catch (error: any) {
      console.error('Paystack Verification Error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to verify Paystack transaction');
    }
  },

  /**
   * Verify Webhook Signature
   */
  verifyWebhookSignature(body: any, signature: string): boolean {
    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY === 'your_paystack_secret_key') {
      console.error('Paystack secret key is not configured for webhook verification');
      return false;
    }
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(body))
      .digest('hex');
    return hash === signature;
  },

  /**
   * Handle successful payment
   */
  async handleSuccessfulPayment(orderId: string, reference: string) {
    try {
      const order = await Order.findById(orderId);
      if (order && order.payment_status !== 'paid') {
        order.payment_status = 'paid';
        order.payment_reference = reference;
        order.status = 'confirmed';
        await order.save();
        console.log(`✅ Order ${orderId} marked as PAID via Paystack (Ref: ${reference})`);
      }
    } catch (error) {
      console.error('Error updating order after Paystack payment:', error);
    }
  }
};
