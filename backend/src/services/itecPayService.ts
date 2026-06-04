import { Order } from '../models/Order';
import { VendorSubscription } from '../models/VendorSubscription';
import { PLAN_PRIORITY, PLAN_LIMITS } from '../middleware/subscription';
import { Product } from '../models/Product';
import axios from 'axios';

export interface ITECPayPaymentResponse {
  status: number;
  data: {
    financial_transaction_id?: string;
    transaction_id: string;
    amount: string;
    currency: string;
    status: string;
  };
}

export interface ITECPayCardResponse {
  status: number;
  PCODE: string;
  amount: number;
  link: string;
  valid_until: string;
}

export interface ITECPayVerifyResponse {
  status: number;
  data: {
    transaction_id: string;
    amount: string;
    status: string;
  };
}

export interface ITECPayCallbackData {
  transaction_id?: string;
  amount?: string;
  status?: string;
}

export const itecPayService = {
  /**
   * Initialize a mobile money payment via ITEC Pay (api2/pay)
   * Supports MTN Mobile Money, Airtel Money, and Spenn
   */
  async initializeMobileMoneyPayment(
    amount: number,
    phone: string,
    provider: 'mtn' | 'airtel' | 'spenn' = 'mtn',
    reqRef?: string,
    note?: string,
    message?: string
  ): Promise<ITECPayPaymentResponse> {
    try {
      const apiKeyMap: Record<string, string> = {
        mtn: process.env.ITECPAY_API_KEY_MOBILE_MONEY || '',
        airtel: process.env.ITECPAY_API_KEY_AIRTEL_MONEY || '',
        spenn: process.env.ITECPAY_API_KEY_MOBILE_MONEY || '', // Using MTN key for Spenn if not provided
      };

      const apiKey = apiKeyMap[provider];

      if (!apiKey) {
        throw new Error(`ITEC Pay API key not configured for provider: ${provider}`);
      }

      const data: any = {
        amount,
        phone,
        key: apiKey,
      };

      if (reqRef) {
        data.req_ref = reqRef;
      }

      if (note) {
        data.note = note;
      }

      if (message) {
        data.message = message;
      }

      const response = await axios.post(
        'https://pay.itecpay.rw/api2/pay',
        data,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('ITEC Pay Mobile Money Error:', error.response?.data || error.message);

      let errorMessage = error.response?.data?.message || error.message || 'Failed to initialize ITEC Pay mobile money payment';

      if (error.response?.status === 400) {
        errorMessage = error.response?.data?.data?.message || 'ITEC Pay authentication failed. Please check your API key.';
      }

      const newError: any = new Error(errorMessage);
      newError.statusCode = error.response?.status || 500;
      throw newError;
    }
  },

  /**
   * Initialize a card payment via ITEC Pay (pesapal/generatecode)
   */
  async initializeCardPayment(
    amount: number,
    email: string,
    reqRef?: string
  ): Promise<ITECPayCardResponse> {
    try {
      const apiKey = process.env.ITECPAY_API_KEY_CARD;

      if (!apiKey) {
        throw new Error('ITEC Pay card API key not configured');
      }

      const data: any = {
        amount: Number(amount), // Amount in RWF
        email,
        key: apiKey,
        currency: 'RWF',
      };

      if (reqRef) {
        data.req_ref = reqRef;
      }

      const response = await axios.post(
        'https://pay.itecpay.rw/api/pay/apis/pesapal/generatecode',
        data,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      // Log full response for debugging
      console.log('ITEC Pay Card Response:', JSON.stringify(response.data));

      // Check for error in response even if HTTP status is 200
      // ITEC Pay may return status as string or number
      const responseStatus = response.data?.status;
      const isSuccess = responseStatus === 200 || responseStatus === '200';
      
      if (!isSuccess) {
        console.error('ITEC Pay Error Response Details:', {
          status: responseStatus,
          message: response.data?.message,
          error: response.data?.error,
          data: response.data
        });
        throw new Error(response.data?.message || response.data?.error || `Payment gateway returned error: ${responseStatus}`);
      }

      // Validate PCODE exists
      if (!response.data?.PCODE) {
        throw new Error('No payment code (PCODE) returned from ITEC Pay');
      }

      // Log the generated payment details
      console.log('ITEC Pay Payment Initialized:', {
        pcode: response.data.PCODE,
        link: response.data.link,
        amount: response.data.amount,
        valid_until: response.data.valid_until
      });

      return response.data;
    } catch (error: any) {
      console.error('ITEC Pay Card Payment Error:', error.response?.data || error.message);

      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to initialize ITEC Pay card payment';
      const newError: any = new Error(errorMessage);
      newError.statusCode = error.response?.status || 500;
      throw newError;
    }
  },

  /**
   * Verify payment status via ITEC Pay
   */
  async verifyPayment(reqRef: string, provider: 'mtn' | 'airtel' | 'spenn' | 'card' = 'mtn'): Promise<ITECPayVerifyResponse> {
    try {
      const apiKeyMap: Record<string, string> = {
        mtn: process.env.ITECPAY_API_KEY_MOBILE_MONEY || '',
        airtel: process.env.ITECPAY_API_KEY_AIRTEL_MONEY || '',
        spenn: process.env.ITECPAY_API_KEY_MOBILE_MONEY || '',
        card: process.env.ITECPAY_API_KEY_CARD || '',
      };

      const apiKey = apiKeyMap[provider];

      if (!apiKey) {
        throw new Error(`ITEC Pay API key not configured for provider: ${provider}`);
      }

      const response = await axios.post(
        'https://pay.itecpay.rw/api2/verify',
        {
          action: 'status_check',
          req_ref: reqRef,
          key: apiKey,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('ITEC Pay Verify Error:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to verify ITEC Pay payment';
      const newError: any = new Error(errorMessage);
      newError.statusCode = error.response?.status || 500;
      throw newError;
    }
  },

  /**
   * Initialize an ITEC Pay transaction (unified interface for checkout)
   */
  async initializeTransaction(
    email: string,
    amount: number,
    orderId: string,
    currency: string = 'RWF',
    channels: string[] = ['card'],
    phone?: string
  ): Promise<{
    status: boolean;
    message: string;
    data: {
      authorization_url: string;
      reference: string;
    };
  }> {
    try {
      const paymentMethod = channels.length > 0 ? channels[0] : 'card';
      // Use a properly formatted reference that ITEC Pay can recognize
      const reqRef = orderId.startsWith('SUB-') ? orderId : `ORD-${orderId}`;

      if (paymentMethod === 'card') {
        const response = await this.initializeCardPayment(amount, email, reqRef);

        // Check response status - handle both number and string status codes
        const responseStatus = response.status;
        const isValidResponse = responseStatus === 200 || String(responseStatus) === '200';
        
        if (!isValidResponse) {
          console.error('ITEC Pay card response validation failed:', response);
          throw new Error('Failed to generate card payment link - invalid response from gateway');
        }

        // Ensure we have a valid link
        let paymentUrl = response.link;
        const pcode = response.PCODE;

        console.log('Processing ITEC Pay card response:', { paymentUrl, pcode });

        // Ensure payment URL exists and is valid
        if (!paymentUrl || paymentUrl === 'undefined' || paymentUrl === 'null') {
          // ITEC Pay Pesapal redirect format - PCODE is the purchase code
          paymentUrl = `https://pay.itecpay.rw/pesapal/pay?PCODE=${encodeURIComponent(pcode)}&reference=${encodeURIComponent(reqRef)}`;
        }

        // Additional validation - ensure URL is properly formatted
        try {
          const urlObj = new URL(paymentUrl);
          // Check if URL points to ITEC Pay domain
          if (!urlObj.hostname.includes('itecpay')) {
            console.warn('Payment URL does not point to ITEC Pay domain, reconstructing...');
            paymentUrl = `https://pay.itecpay.rw/pesapal/pay?PCODE=${encodeURIComponent(pcode)}&reference=${encodeURIComponent(reqRef)}`;
          }
        } catch {
          // URL is malformed, reconstruct it
          console.warn('Malformed payment URL received, reconstructing...');
          paymentUrl = `https://pay.itecpay.rw/pesapal/pay?PCODE=${encodeURIComponent(pcode)}&reference=${encodeURIComponent(reqRef)}`;
        }

        // Validate the URL before returning
        if (!paymentUrl || (!paymentUrl.startsWith('http://') && !paymentUrl.startsWith('https://'))) {
          throw new Error('Invalid payment redirection URL received from gateway');
        }

        return {
          status: true,
          message: 'Card payment initialized',
          data: {
            authorization_url: paymentUrl,
            reference: reqRef,
          },
        };
      } else {
        // Mobile money (MTN, Airtel, or Spenn)
        const provider = paymentMethod === 'mobile_money' ? 'mtn' : paymentMethod as 'mtn' | 'airtel' | 'spenn';

        if (!phone) {
          throw new Error('Phone number is required for mobile money payments');
        }

        const response = await this.initializeMobileMoneyPayment(
          amount,
          phone,
          provider,
          reqRef,
          `Order: ${orderId}`,
          `Payment for order ${orderId}`
        );

        if (response.status !== 200) {
          throw new Error('Failed to initialize mobile money payment');
        }

        // For mobile money, the authorization_url can be a prompt or status check URL
        return {
          status: true,
          message: 'Mobile money payment initialized',
          data: {
            authorization_url: `https://pay.itecpay.rw/api2/verify?req_ref=${response.data.transaction_id}`,
            reference: reqRef,
          },
        };
      }
    } catch (error: any) {
      console.error('ITEC Pay Initialization Error:', error.response?.data || error.message);

      const errorMessage = error.response?.data?.message || error.message || 'Failed to initialize ITEC Pay transaction';
      const newError: any = new Error(errorMessage);
      newError.statusCode = error.response?.status || 500;
      throw newError;
    }
  },

  /**
   * Verify ITEC Pay callback data
   */
  verifyCallback(callbackData: ITECPayCallbackData, secretKey: string): boolean {
    if (!callbackData.transaction_id || !callbackData.amount || !callbackData.status) {
      return false;
    }
    return true;
  },

  /**
   * Handle successful ITEC Pay payment
   */
  async handleSuccessfulPayment(orderIdsString: string, transID: string, amount: string) {
    try {
      const allIds = orderIdsString.split(',').map(id => id.trim()).filter(id => id !== '');

      const subIds = allIds.filter(id => id.startsWith('SUB-'));
      const orderIds = allIds.filter(id => !id.startsWith('SUB-'));

      // --- Activate subscriptions ---
      for (const subEntry of subIds) {
        const subscriptionId = subEntry.replace(/^SUB-/, '');
        try {
          const subscription = await VendorSubscription.findById(subscriptionId);
          if (!subscription) {
            console.warn(`ITEC Pay Webhook: Subscription ${subscriptionId} not found`);
            continue;
          }

          if (subscription.status === 'active' && subscription.payment_reference === transID && !subscription.pending_plan) {
            console.log(`ITEC Pay Webhook: Subscription ${subscriptionId} already active`);
            continue;
          }

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

          await Product.updateMany(
            { vendor_username: subscription.vendor_username },
            {
              vendor_plan: subscription.plan,
              plan_priority: PLAN_PRIORITY[subscription.plan as keyof typeof PLAN_PRIORITY] || 0,
            }
          );
        } catch (subErr) {
          console.error(`ITEC Pay Webhook: Failed to activate subscription ${subscriptionId}:`, subErr);
        }
      }

      // --- Mark orders as paid ---
      // Strip ORD- prefix from order IDs if present (we add it when creating transaction)
      const cleanOrderIds = orderIds.map(id => id.startsWith('ORD-') ? id.substring(4) : id);
      
      if (cleanOrderIds.length > 0) {
        const result = await Order.updateMany(
          { _id: { $in: cleanOrderIds }, payment_status: { $ne: 'paid' } },
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
          console.log(`ITEC Pay: ${result.modifiedCount} order(s) marked as paid (Ref: ${transID})`);
        }
      }
    } catch (error) {
      console.error('Error handling ITEC Pay successful payment:', error);
    }
  }
};