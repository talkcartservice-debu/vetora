import { paymentAPI } from '@/api/apiClient';

/**
 * Initializes and opens ITEC Pay checkout
 * @param {Object} options - Payment options
 * @param {number} options.amount - Amount in RWF
 * @param {string} options.email - Customer email
 * @param {string} options.phone - Customer phone (required for mobile money)
 * @param {string} options.order_id - Order ID for metadata
 * @param {string[]} options.channels - Payment channels (optional)
 * @param {string} options.payment_method - Payment method: 'card', 'mtn', 'airtel', 'spenn' (optional)
 * @param {Function} options.onSuccess - Callback on success
 * @param {Function} options.onClose - Callback on close
 */
export const initializeITECPayPayment = async ({ amount, email, phone, order_id, channels, payment_method, onSuccess, onClose }) => {
  try {
    // 1. Initialize on backend to get authorization URL or reference
    const response = await paymentAPI.itecpay.initialize({
      amount,
      email,
      phone,
      order_id,
      channels,
      payment_method
    });

    if (response.status && response.data.authorization_url) {
      // Redirect to authorization URL for card payments
      window.location.href = response.data.authorization_url;
    } else if (response.status) {
      // Mobile money payment initiated - check status
      console.log('ITEC Pay payment initialized, check phone for prompt');
      if (onSuccess) onSuccess(response);
    } else {
      throw new Error('Failed to initialize ITEC Pay payment');
    }
  } catch (error) {
    console.error('ITEC Pay initialization error:', error);
    throw error;
  }
};

/**
 * Verifies a payment after redirect back
 * @param {string} reference - ITEC Pay reference
 * @returns {Promise<Object>} - Verification status
 */
export const verifyITECPayPayment = async (reference, provider = 'mtn') => {
  try {
    return await paymentAPI.itecpay.verify({ req_ref: reference, provider });
  } catch (error) {
    console.error('ITEC Pay verification error:', error);
    throw error;
  }
};