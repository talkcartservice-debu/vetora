import axios from 'axios';
import crypto from 'crypto';
import { Order } from '../models/Order';
import { VendorSubscription } from '../models/VendorSubscription';
import { PLAN_PRIORITY, PLAN_LIMITS } from '../middleware/subscription';
import { Product } from '../models/Product';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_CURRENCY = process.env.PAYSTACK_CURRENCY || 'RWF';

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
  async initializeTransaction(email: string, amount: number, orderId: string, currency: string = PAYSTACK_CURRENCY, channels: string[] = [], phone?: string): Promise<PaystackInitializeResponse> {
    if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY === 'your_paystack_secret_key' || PAYSTACK_SECRET_KEY === '') {
      const error: any = new Error('Paystack secret key is not configured. Please set PAYSTACK_SECRET_KEY in your environment variables.');
      error.statusCode = 503;
      throw error;
    }
    try {
      const data: any = {
        amount: Math.round(amount * 100), // Convert to kobo/cents
        email,
        metadata: {
          order_id: orderId,
        },
      };

      if (currency) {
        data.currency = currency;
      }

      if (phone) {
        data.metadata.phone = phone;
      }

      if (channels && channels.length > 0) {
        data.channels = channels;
      }

      const response = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        data,
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
   * Handle successful payment — routes to subscription or order logic based on ID prefix.
   */
  async handleSuccessfulPayment(orderIdsString: string, reference: string) {
    try {
      const allIds = orderIdsString.split(',').filter(id => id.trim() !== '');

      const subIds = allIds.filter(id => id.trim().startsWith('SUB-'));
      const orderIds = allIds.filter(id => !id.trim().startsWith('SUB-'));

      // --- Activate subscriptions ---
      for (const subEntry of subIds) {
        const subscriptionId = subEntry.trim().replace(/^SUB-/, '');
        try {
          const subscription = await VendorSubscription.findById(subscriptionId);
          if (!subscription) {
            console.warn(`⚠️ Webhook: Subscription ${subscriptionId} not found`);
            continue;
          }

          // Already active with same reference — idempotent guard
          if (subscription.status === 'active' && subscription.payment_reference === reference && !subscription.pending_plan) {
            console.log(`ℹ️ Webhook: Subscription ${subscriptionId} already active with ref ${reference}`);
            continue;
          }

          // Promote pending upgrade (active paid → higher tier) or activate pending subscription
          if (subscription.pending_plan) {
            subscription.plan = subscription.pending_plan;
            subscription.billing_cycle = (subscription.pending_billing_cycle || subscription.billing_cycle) as 'monthly' | 'annual';
            subscription.pending_plan = undefined;
            subscription.pending_billing_cycle = undefined;
          }

          subscription.status = 'active';
          subscription.payment_reference = reference;
          subscription.last_payment_date = new Date();

          const now = new Date();
          subscription.expires_at = subscription.billing_cycle === 'annual'
            ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
            : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

          await subscription.save();

          // Sync products to the newly active plan
          await Product.updateMany(
            { vendor_username: subscription.vendor_username },
            {
              vendor_plan: subscription.plan,
              plan_priority: PLAN_PRIORITY[subscription.plan as keyof typeof PLAN_PRIORITY] || 0,
            }
          );

          console.log(`✅ Webhook: Subscription ${subscriptionId} activated → plan=${subscription.plan} (Ref: ${reference})`);
        } catch (subErr) {
          console.error(`❌ Webhook: Failed to activate subscription ${subscriptionId}:`, subErr);
        }
      }

      // --- Mark orders as paid ---
      if (orderIds.length > 0) {
        const result = await Order.updateMany(
          { _id: { $in: orderIds }, payment_status: { $ne: 'paid' } },
          { 
            $set: { 
              payment_status: 'paid',
              payment_reference: reference,
              status: 'confirmed',
              updated_at: new Date()
            }
          }
        );

        if (result.modifiedCount > 0) {
          console.log(`✅ ${result.modifiedCount} Order(s) [${orderIds.join(', ')}] marked as PAID via Paystack (Ref: ${reference})`);
        }
      }
    } catch (error) {
      console.error('Error handling Paystack successful payment:', error);
    }
  }
};
