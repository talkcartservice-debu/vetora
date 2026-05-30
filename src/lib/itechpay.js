import { paymentAPI } from '@/api/apiClient';

/**
 * Initializes and opens iTechPay checkout
 * @param {Object} options - Payment options
 * @param {number} options.amount - Amount in RWF
 * @param {string} options.email - Customer email
 * @param {string} options.phone - Customer phone (optional)
 * @param {string} options.order_id - Order ID for metadata
 * @param {string} options.channel - Payment channel: 'card', 'mtn', 'airtel', 'mobile_money'
 * @param {Function} options.onSuccess - Callback on success
 * @param {Function} options.onClose - Callback on close
 */
export const initializeITechPayPayment = async ({ amount, email, phone, order_id, channel, onSuccess, onClose }) => {
  try {
    const response = await paymentAPI.itechpay.initialize({
      amount,
      email,
      phone,
      order_id,
      channel
    });

    if (response.status && response.data.payment_url) {
      window.location.href = response.data.payment_url;
    } else {
      throw new Error('Failed to initialize iTechPay payment');
    }
  } catch (error) {
    console.error('iTechPay initialization error:', error);
    throw error;
  }
};

/**
 * Verifies a payment after redirect back
 * @param {string} reference - iTechPay reference / transID
 * @returns {Promise<Object>} - Verification status
 */
export const verifyPayment = async (reference) => {
  try {
    return await paymentAPI.itechpay.verify(reference);
  } catch (error) {
    console.error('iTechPay verification error:', error);
    throw error;
  }
};
