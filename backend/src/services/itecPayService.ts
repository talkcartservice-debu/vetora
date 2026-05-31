import { Order } from '../models/Order';
import { VendorSubscription } from '../models/VendorSubscription';
import { PLAN_PRIORITY, PLAN_LIMITS } from '../middleware/subscription';
import { Product } from '../models/Product';

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
   * Note: This is a placeholder implementation. You'll need to adapt this based on
   * how ITEC Pay actually expects payment initialization to work.
   */
  async initializeTransaction(email: string, amount: number, orderId: string, currency: string = 'RWF', channels: string[] = [], phone?: string): Promise<ITECPayInitializeResponse> {
    try {
      // TODO: Replace this with actual ITEC Pay initialization logic
      // For now, we'll return a mock response that the frontend can use to redirect
      // to ITEC Pay's payment page. You'll need to implement the actual ITEC Pay
      // payment URL generation based on their documentation.
      
      // Example: Generate a reference for tracking
      const reference = `ITEC_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
      
      // This would be the URL where users should be redirected to pay via ITEC Pay
      // You need to replace this with the actual ITEC Pay payment URL format
      const paymentUrl = `https://itecpay.com/pay?amount=${amount}&reference=${reference}&email=${email}`;
      
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
      console.error('ITEC Pay Initialization Error:', error.message);
      
      let errorMessage = error.message || 'Failed to initialize ITEC Pay transaction';
      
      const newError: any = new Error(errorMessage);
      newError.statusCode = 500;
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