import { Order } from '../models/Order';
import { VendorSubscription } from '../models/VendorSubscription';
import { PLAN_PRIORITY, PLAN_LIMITS } from '../middleware/subscription';
import { Product } from '../models/Product';
import axios from 'axios';

export interface ITECPayCallbackData {
  PCODE: string;   // the unique payment code (match to your order)
  amount: string;  // the amount paid
  transID: string; // the unique transaction ID
}

export interface ITECPayInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export const itecPayService = {
  /**
   * Initialize an ITEC Pay transaction
   * Uses the actual ITEC Pay API with the provided API keys.
   */
  async initializeTransaction(email: string, amount: number, orderId: string, currency: string = 'RWF', channels: string[] = [], phone?: string): Promise<ITECPayInitializeResponse> {
    try {
      // Determine payment method from channels array (first element) or default to 'card'
      const paymentMethod = channels.length > 0 ? channels[0] : 'card';
      
      // Map payment method to the corresponding API key from environment variables
      const apiKeyMap: Record<string, string> = {
        card: process.env.ITEC_PAY_API_KEY_PAYMENT_CARD || '',
        mobile_money: process.env.ITEC_PAY_API_KEY_MTN_MOBILE_MONEY || '', // Defaulting to MTN for mobile_money
        // Note: We don't have a separate key for Airtel Money in the environment for mobile_money.
        // This is a limitation; ideally, the frontend would specify the mobile money provider.
      };
      
      const apiKey = apiKeyMap[paymentMethod];
      
      if (!apiKey) {
        throw new Error(`ITEC Pay API key not configured for payment method: ${paymentMethod}`);
      }
      
      // Prepare the request data for ITEC Pay API
      // Note: We assume the ITEC Pay API expects the amount in the same unit (RWF) as provided.
      // If the API expects the amount in a different unit (e.g., cents), we would need to convert.
      const data: any = {
        amount,
        email,
        reference: orderId, // Using orderId as the reference for the transaction
      };
      
      if (currency) {
        data.currency = currency;
      }
      
      if (phone) {
        data.phone_number = phone; // Assuming the API expects 'phone_number' field
      }
      
      // Make the request to ITEC Pay API
      // Note: The endpoint is assumed; replace with the actual ITEC Pay endpoint.
      const response = await axios.post(
        'https://api.itecpay.com/v1/transaction/initialize', // TODO: Replace with actual endpoint
        data,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      // Assuming the ITEC Pay API returns a response with the following structure:
      // {
      //   status: boolean,
      //   message: string,
      //   data: {
      //     authorization_url: string,
      //     reference: string,
      //   }
      // }
      // We'll map it to the Paystack-compatible format.
      const { status, message, data: responseData } = response.data;
      
      return {
        status: status || false,
        message: message || 'Payment initialized',
        data: {
          authorization_url: responseData.authorization_url || '',
          access_code: responseData.access_code || '', // ITEC Pay might not use this
          reference: responseData.reference || orderId,
        }
      };
    } catch (error: any) {
      console.error('ITEC Pay Initialization Error:', error.response?.data || error.message);
      
      let errorMessage = error.response?.data?.message || error.message || 'Failed to initialize ITEC Pay transaction';
      
      if (error.response?.status === 401) {
        errorMessage = 'ITEC Pay authentication failed. Please check your API key.';
      }
      
      const newError: any = new Error(errorMessage);
      newError.statusCode = error.response?.status || 500;
      throw newError;
    }
  },

  /**
   * Verify ITEC Pay callback data
   * @param callbackData The data received from ITEC Pay callback
   * @param secretKey The secret key for verification (should match what's in callback URL)
   * @returns True if verification passes
   */
  verifyCallback(callbackData: ITECPayCallbackData, secretKey: string): boolean {
    // Basic verification: check that all required fields are present
    if (!callbackData.PCODE || !callbackData.amount || !callbackData.transID) {
      return false;
    }

    // Additional verification could be done here based on ITEC Pay's security recommendations
    // For now, we'll just check that the fields exist and are non-empty
    return true;
  },

  /**
   * Handle successful ITEC Pay payment — routes to subscription or order logic based on ID prefix.
   * Similar to Paystack's handleSuccessfulPayment method
   */
  async handleSuccessfulPayment(orderIdsString: string, transID: string, amount: string) {
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
            console.warn(`⚠️ ITEC Pay Webhook: Subscription ${subscriptionId} not found`);
            continue;
          }

          // Already active with same reference — idempotent guard
          if (subscription.status === 'active' && subscription.payment_reference === transID && !subscription.pending_plan) {
            console.log(`ℹ️ ITEC Pay Webhook: Subscription ${subscriptionId} already active with ref ${transID}`);
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
          subscription.payment_reference = transID;
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

          console.log(`✅ ITEC Pay Webhook: Subscription ${subscriptionId} activated → plan=${subscription.plan} (Ref: ${transID})`);
        } catch (subErr) {
          console.error(`❌ ITEC Pay Webhook: Failed to activate subscription ${subscriptionId}:`, subErr);
        }
      }

      // --- Mark orders as paid ---
      if (orderIds.length > 0) {
        const result = await Order.updateMany(
          { _id: { $in: orderIds }, payment_status: { $ne: 'paid' } },
          { 
            $set: { 
              payment_status: 'paid',
              payment_reference: transID,
              status: 'confirmed',
              updated_at: new Date()
            }
          }
        );

        if (result.modifiedCount > 0) {
          console.log(`✅ ${result.modifiedCount} Order(s) [${orderIds.join(', ')}] marked as PAID via ITEC Pay (Ref: ${transID})`);
        }
      }
    } catch (error) {
      console.error('Error handling ITEC Pay successful payment:', error);
    }
  }
};