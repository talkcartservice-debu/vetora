import { paymentAPI } from '@/api/apiClient';

/**
 * Initializes and opens Paystack checkout
 * @param {Object} options - Payment options
 * @param {number} options.amount - Amount in kobo
 * @param {string} options.email - Customer email
 * @param {string} options.order_id - Order ID for metadata
 * @param {Function} options.onSuccess - Callback on success
 * @param {Function} options.onClose - Callback on close
 */
export const initializePaystackPayment = async ({ amount, email, order_id, onSuccess, onClose }) => {
  try {
    // 1. Initialize on backend to get authorization URL or reference
    const response = await paymentAPI.initialize({
      amount,
      email,
      order_id
    });

    if (response.status && response.data.authorization_url) {
      // Redirect to authorization URL or use inline if possible
      window.location.href = response.data.authorization_url;
    } else {
      throw new Error('Failed to initialize Paystack payment');
    }
  } catch (error) {
    console.error('Paystack initialization error:', error);
    throw error;
  }
};

/**
 * Verifies a payment after redirect back
 * @param {string} reference - Paystack reference
 * @returns {Promise<Object>} - Verification status
 */
export const verifyPayment = async (reference) => {
  try {
    return await paymentAPI.verify(reference);
  } catch (error) {
    console.error('Paystack verification error:', error);
    throw error;
  }
};
