import axios from 'axios';
import crypto from 'crypto';
import { Order } from '../models/Order';
import { VendorSubscription } from '../models/VendorSubscription';
import { PLAN_PRIORITY, PLAN_LIMITS } from '../middleware/subscription';
import { Product } from '../models/Product';

const ITECHPAY_BASE_URL = process.env.ITECHPAY_BASE_URL || 'https://pay.itecpay.rw/api';
const ITECHPAY_CALLBACK_URL = process.env.ITECHPAY_CALLBACK_URL || '';
const ITECHPAY_CALLBACK_SECRET = process.env.ITECHPAY_CALLBACK_SECRET || '';

// Per-channel API keys
const ITECHPAY_MTN_KEY = process.env.ITECHPAY_MTN_KEY || '';
const ITECHPAY_AIRTEL_KEY = process.env.ITECHPAY_AIRTEL_KEY || '';
const ITECHPAY_CARD_KEY = process.env.ITECHPAY_CARD_KEY || '';

type PaymentChannel = 'mtn' | 'airtel' | 'card';

function getApiKey(channel: PaymentChannel): string {
  switch (channel) {
    case 'mtn': return ITECHPAY_MTN_KEY;
    case 'airtel': return ITECHPAY_AIRTEL_KEY;
    case 'card': return ITECHPAY_CARD_KEY;
  }
}

function resolveChannel(method: string): PaymentChannel {
  if (method === 'mobile_money' || method === 'mtn') return 'mtn';
  if (method === 'airtel') return 'airtel';
  return 'card';
}

export interface ITechPayInitResponse {
  status: boolean;
  message: string;
  data: {
    payment_url: string;
    pcode: string;
    reference: string;
  };
}

export const itechpayService = {
  /**
   * Initialize an iTechPay payment request
   */
  async initializeTransaction(
    email: string,
    amount: number,
    orderId: string,
    channel: string = 'card',
    phone?: string
  ): Promise<ITechPayInitResponse> {
    const paymentChannel = resolveChannel(channel);
    const apiKey = getApiKey(paymentChannel);

    if (!apiKey) {
      const error: any = new Error(
        `iTechPay API key is not configured for channel "${paymentChannel}". ` +
        `Please set ITECHPAY_${paymentChannel.toUpperCase()}_KEY in your environment variables.`
      );
      error.statusCode = 503;
      throw error;
    }

    try {
      // Generate a unique payment code for this transaction
      const pcode = `IQON-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

      // Build callback URL with secret for verification
      const callbackUrl = ITECHPAY_CALLBACK_URL
        ? `${ITECHPAY_CALLBACK_URL}?secret=${encodeURIComponent(ITECHPAY_CALLBACK_SECRET)}`
        : '';

      // ITECPay uses HTTP form POST
      const params = new URLSearchParams();
      params.append('apiKey', apiKey);
      params.append('PCODE', pcode);
      params.append('amount', String(amount));
      params.append('orderId', orderId);
      params.append('channel', paymentChannel);
      if (email) params.append('email', email);
      if (phone) params.append('phone', phone);
      if (callbackUrl) params.append('callbackUrl', callbackUrl);

      const response = await axios.post(
        `${ITECHPAY_BASE_URL}/RequestPayment`,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const responseData = response.data;

      // Return normalized response
      return {
        status: true,
        message: responseData.message || 'Payment initiated',
        data: {
          payment_url: responseData.payment_url || responseData.authorization_url || '',
          pcode: responseData.PCODE || pcode,
          reference: responseData.transID || responseData.reference || pcode,
        },
      };
    } catch (error: any) {
      const errorData = error.response?.data;
      console.error('iTechPay Initialization Error:', errorData || error.message);

      let errorMessage =
        errorData?.message || error.message || 'Failed to initialize iTechPay transaction';

      if (error.response?.status === 401) {
        errorMessage =
          'iTechPay authentication failed. Please check if your API key is valid.';
      }

      const newError: any = new Error(errorMessage);
      newError.details = errorData;
      newError.statusCode = error.response?.status || 500;
      throw newError;
    }
  },

  /**
   * Verify an iTechPay transaction by PCODE / transID
   */
  async verifyTransaction(reference: string) {
    try {
      // Try verification via the API
      const params = new URLSearchParams();
      params.append('apiKey', ITECHPAY_CARD_KEY || ITECHPAY_MTN_KEY || ITECHPAY_AIRTEL_KEY);
      params.append('transID', reference);

      const response = await axios.post(
        `${ITECHPAY_BASE_URL}/VerifyTransaction`,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const data = response.data;

      if (data.status === 'success' || data.status === 'completed') {
        const orderId = data.orderId || data.metadata?.order_id;
        if (orderId) {
          await this.handleSuccessfulPayment(orderId, reference);
        }
      }

      return {
        status: true,
        data: {
          status: data.status || 'unknown',
          amount: data.amount,
          reference: data.transID || reference,
          pcode: data.PCODE,
          metadata: { order_id: data.orderId },
        },
      };
    } catch (error: any) {
      console.error('iTechPay Verification Error:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.message || 'Failed to verify iTechPay transaction'
      );
    }
  },

  /**
   * Verify callback authenticity using the secret query parameter
   */
  verifyCallbackSecret(secret: string): boolean {
    if (!ITECHPAY_CALLBACK_SECRET) {
      console.error('iTechPay callback secret is not configured');
      return false;
    }
    return secret === ITECHPAY_CALLBACK_SECRET;
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
            console.warn(`⚠️ Callback: Subscription ${subscriptionId} not found`);
            continue;
          }

          // Already active with same reference — idempotent guard
          if (subscription.status === 'active' && subscription.payment_reference === reference && !subscription.pending_plan) {
            console.log(`ℹ️ Callback: Subscription ${subscriptionId} already active with ref ${reference}`);
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

          console.log(`✅ Callback: Subscription ${subscriptionId} activated → plan=${subscription.plan} (Ref: ${reference})`);
        } catch (subErr) {
          console.error(`❌ Callback: Failed to activate subscription ${subscriptionId}:`, subErr);
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
              updated_at: new Date(),
            },
          }
        );

        if (result.modifiedCount > 0) {
          console.log(`✅ ${result.modifiedCount} Order(s) [${orderIds.join(', ')}] marked as PAID via iTechPay (Ref: ${reference})`);
        }
      }
    } catch (error) {
      console.error('Error handling iTechPay successful payment:', error);
    }
  },
};
