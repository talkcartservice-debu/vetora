/// <reference types="vite/client" />

/**
 * API Client for Vetora Backend
 * Replaces Base44 SDK with direct API calls
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class APIClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = null;
  }

  // Set JWT token for authenticated requests
  setToken(token) {
    this.token = token;
  }

  // Get JWT token
  getToken() {
    return this.token;
  }

  // Clear token
  clearToken() {
    this.token = null;
  }

  // Build headers with token
  getHeaders(additionalHeaders = {}, isFormData = false) {
    const headers = {
      ...additionalHeaders
    };

    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  // Generic fetch wrapper
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const {
      method = 'GET',
      body = null,
      headers: additionalHeaders = {},
      ...otherOptions
    } = options;

    const isFormData = body instanceof FormData;

    const config = {
      method,
      headers: this.getHeaders(additionalHeaders, isFormData),
      body: undefined,
      ...otherOptions
    };

    if (body && !['GET', 'HEAD'].includes(method)) {
      config.body = isFormData ? body : JSON.stringify(body);
    }

    try {
      const response = await fetch(url, config);

      // Handle unauthorized
      if (response.status === 401) {
        this.clearToken();
        localStorage.removeItem('vetora_token');
        // If we are in the browser, redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw new Error('Unauthorized - Please login again');
      }

      let data;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } else {
        data = await response.text();
      }

      const error = new Error(data?.error || data?.message || `API Error: ${response.status}`);
      error.status = response.status;
      
      if (!response.ok) {
        // Don't log 404 errors - they're often expected (e.g., checking if resource exists)
        if (response.status !== 404) {
          console.error(`API Error [${endpoint}]:`, error);
        }
        throw error;
      }

      return data;
    } catch (error) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        console.error(`Network Error [${endpoint}]: Please check your internet connection.`);
        throw new Error('Network error - could not connect to server');
      }
      // Only log if it's not a 404 error (already logged above) or if already logged
      if (error.status !== 404) {
        console.error(`API Error [${endpoint}]:`, error);
      }
      throw error;
    }
  }

  // GET request
  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  // POST request
  post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  // PUT request
  put(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body });
  }

  // PATCH request
  patch(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body });
  }

  // DELETE request
  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  // Build query string from object
  buildQueryString(params = {}) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, v));
        } else {
          searchParams.append(key, value);
        }
      }
    }
    return searchParams.toString();
  }
}

// Create singleton instance
export const apiClient = new APIClient();

// Export individual entity API modules
export const authAPI = {
  login: async (email, password) => {
    const data = await apiClient.post('/auth/login', { email, password });
    if (data.token) {
      apiClient.setToken(data.token);
      localStorage.setItem('vetora_token', data.token);
    }
    return data;
  },
  register: async (userData) => {
    const data = await apiClient.post('/auth/register', userData);
    if (data.token) {
      apiClient.setToken(data.token);
      localStorage.setItem('vetora_token', data.token);
    }
    return data;
  },
  me: () => apiClient.get('/auth/me'),
  updateProfile: (data) => apiClient.patch('/auth/me', data),
  logout: () => {
    apiClient.clearToken();
    localStorage.removeItem('vetora_token');
  },
  initialize: () => {
    const token = localStorage.getItem('vetora_token');
    if (token) {
      apiClient.setToken(token);
    }
    return token;
  }
};

export const productsAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/products?${query}`);
  },
  get: (id) => apiClient.get(`/products/${id}`),
  create: (data) => apiClient.post('/products', data),
  update: (id, data) => apiClient.put(`/products/${id}`, data),
  delete: (id) => apiClient.delete(`/products/${id}`),
  search: (query) => apiClient.get(`/products?search=${encodeURIComponent(query)}`)
};

export const ordersAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/orders?${query}`);
  },
  get: (id) => apiClient.get(`/orders/${id}`),
  create: (data) => apiClient.post('/orders', data),
  update: (id, data) => apiClient.put(`/orders/${id}`, data),
  cancelOrder: (id) => apiClient.post(`/orders/${id}/cancel`, {})
};

export const cartAPI = {
  get: () => apiClient.get('/cart'),
  add: (data) => apiClient.post('/cart', data),
  update: (itemId, data) => apiClient.put(`/cart/${itemId}`, data),
  remove: (itemId) => apiClient.delete(`/cart/${itemId}`),
  clear: () => apiClient.delete('/cart')
};

export const postsAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/posts?${query}`);
  },
  get: (id) => apiClient.get(`/posts/${id}`),
  create: (data) => apiClient.post('/posts', data),
  update: (id, data) => apiClient.put(`/posts/${id}`, data),
  delete: (id) => apiClient.delete(`/posts/${id}`),
  like: (id) => apiClient.post(`/posts/${id}/like`, {}),
  unlike: (id) => apiClient.delete(`/posts/${id}/like`)
};

export const commentsAPI = {
  list: (postId, filters = {}) => {
    const query = apiClient.buildQueryString({ ...filters, post_id: postId });
    return apiClient.get(`/comments?${query}`);
  },
  create: (data) => apiClient.post('/comments', data),
  update: (id, data) => apiClient.put(`/comments/${id}`, data),
  delete: (id) => apiClient.delete(`/comments/${id}`),
  like: (id) => apiClient.post(`/comments/${id}/like`, {}),
  unlike: (id) => apiClient.delete(`/comments/${id}/like`)
};

export const storesAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/stores?${query}`);
  },
  get: (id) => apiClient.get(`/stores/${id}`),
  create: (data) => apiClient.post('/stores', data),
  update: (id, data) => apiClient.put(`/stores/${id}`, data),
  getByOwner: (email) => apiClient.get(`/stores/owner/${email}`)
};

export const usersAPI = {
  getProfile: (email) => apiClient.get(`/users/${email}`),
  search: (query) => apiClient.get(`/users/search?q=${encodeURIComponent(query)}`)
};

export const communitiesAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/communities?${query}`);
  },
  get: (id) => apiClient.get(`/communities/${id}`),
  create: (data) => apiClient.post('/communities', data),
  update: (id, data) => apiClient.put(`/communities/${id}`, data),
  join: (id) => apiClient.post(`/communities/${id}/join`, {}),
  leave: (id) => apiClient.post(`/communities/${id}/leave`, {})
};

export const communityMembersAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/community-members?${query}`);
  },
  update: (id, data) => apiClient.put(`/community-members/${id}`, data),
  delete: (id) => apiClient.delete(`/community-members/${id}`),
};

export const messagesAPI = {
  listConversations: () => apiClient.get('/messages/conversations'),
  list: (conversationId) => apiClient.get(`/messages/${conversationId}`),
  query: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/messages?${query}`);
  },
  send: (data) => apiClient.post('/messages', data),
  update: (id, data) => apiClient.patch(`/messages/${id}`, data),
  delete: (id) => apiClient.delete(`/messages/${id}`),
  markAsRead: (id) => apiClient.patch(`/messages/${id}/read`),
  markConversationAsRead: (conversationId) => apiClient.patch(`/messages/conversation/${conversationId}/read`),
};

export const notificationsAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/notifications?${query}`);
  },
  markAsRead: (id) => apiClient.patch(`/notifications/${id}/read`),
  markAllAsRead: () => apiClient.patch('/notifications/read-all'),
  delete: (id) => apiClient.delete(`/notifications/${id}`)
};

export const wishlistAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/wishlist?${query}`);
  },
  check: (productId) => apiClient.get(`/wishlist/check/${productId}`),
  add: (data) => apiClient.post('/wishlist', data),
  remove: (productId) => apiClient.delete(`/wishlist/${productId}`),
  getStats: () => apiClient.get('/wishlist/stats')
};

export const reviewsAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/reviews?${query}`);
  },
  get: (id) => apiClient.get(`/reviews/${id}`),
  create: (data) => apiClient.post('/reviews', data),
  update: (id, data) => apiClient.put(`/reviews/${id}`, data),
  delete: (id) => apiClient.delete(`/reviews/${id}`),
  listByStore: (storeId, filters = {}) => {
    const query = apiClient.buildQueryString({ ...filters, store_id: storeId });
    return apiClient.get(`/reviews/store/${storeId}?${query}`);
  },
};

export const storeReviewsAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/store-reviews?${query}`);
  },
  get: (id) => apiClient.get(`/store-reviews/${id}`),
  create: (data) => apiClient.post('/store-reviews', data),
  update: (id, data) => apiClient.put(`/store-reviews/${id}`, data),
  delete: (id) => apiClient.delete(`/store-reviews/${id}`),
};

export const likesAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/likes?${query}`);
  },
  create: (data) => apiClient.post('/likes', data),
  delete: (id) => apiClient.delete(`/likes/${id}`),
  check: (targetId, targetType) => {
    const query = apiClient.buildQueryString({ target_id: targetId, target_type: targetType });
    return apiClient.get(`/likes/check?${query}`);
  }
};

export const followAPI = {
  follow: (email, followType = 'user') => apiClient.post('/follows', { following_email: email, follow_type: followType }),
  unfollow: (email, followType = 'user') => {
    const query = apiClient.buildQueryString({ following_email: email, follow_type: followType });
    return apiClient.delete(`/follows?${query}`);
  },
  getFollowing: (email) => {
    const query = apiClient.buildQueryString({ follower_email: email });
    return apiClient.get(`/follows/following?${query}`);
  },
  getFollowers: (email) => {
    const query = apiClient.buildQueryString({ following_email: email });
    return apiClient.get(`/follows/followers?${query}`);
  },
  check: (follower, following) => {
    const query = apiClient.buildQueryString({ follower_email: follower, following_email: following });
    return apiClient.get(`/follows/check?${query}`);
  }
};

export const storiesAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/stories?${query}`);
  },
  getByUser: (email) => apiClient.get(`/stories/user/${email}`),
  getFeed: () => apiClient.get('/stories/feed'),
  create: (data) => apiClient.post('/stories', data),
  view: (id) => apiClient.post(`/stories/${id}/view`, {}),
  delete: (id) => apiClient.delete(`/stories/${id}`)
};

export const liveSessionsAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/live-sessions?${query}`);
  },
  get: (id) => apiClient.get(`/live-sessions/${id}`),
  create: (data) => apiClient.post('/live-sessions', data),
  update: (id, data) => apiClient.put(`/live-sessions/${id}`, data),
  start: (id) => apiClient.post(`/live-sessions/${id}/start`, {}),
  end: (id) => apiClient.post(`/live-sessions/${id}/end`, {})
};

export const filesAPI = {
  getUploadSignature: () => apiClient.get('/files/upload-signature'),
  upload: async (file) => {
    // Convert file to base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = reader.result;
          
          // Log file info for debugging
          console.log('Uploading file:', {
            name: file.name,
            type: file.type,
            size: `${Math.round(file.size / 1024)}KB`,
          });
          
          const response = await apiClient.post('/files/upload', { file: base64 });
          resolve(response);
        } catch (error) {
          console.error('File upload failed:', error);
          reject(error);
        }
      };
      reader.onerror = () => {
        const error = new Error('Failed to read file');
        console.error('FileReader error:', error);
        reject(error);
      };
      reader.readAsDataURL(file);
    });
  },
  uploadDirect: (fileBase64) => apiClient.post('/files/upload', { file: fileBase64 }),
  delete: (publicId) => apiClient.delete(`/files/${publicId}`),
  // Client-side Cloudinary upload helper
  uploadToCloudinary: async (file, signatureData) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', signatureData.api_key);
    formData.append('timestamp', signatureData.timestamp);
    formData.append('signature', signatureData.signature);
    formData.append('folder', signatureData.folder);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${signatureData.cloud_name}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || 'Cloudinary upload failed');
    }
    return data;
  }
};

export const paymentAPI = {
  initialize: (data) => apiClient.post('/payments/initialize', data),
  verify: (reference) => apiClient.get(`/payments/verify/${reference}`),
};

export const affiliateLinksAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/affiliate-links?${query}`);
  },
  get: (id) => apiClient.get(`/affiliate-links/${id}`),
  create: (data) => apiClient.post('/affiliate-links', data),
  update: (id, data) => apiClient.patch(`/affiliate-links/${id}`, data),
  delete: (id) => apiClient.delete(`/affiliate-links/${id}`)
};

export const withdrawalsAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/withdrawals?${query}`);
  },
  create: (data) => apiClient.post('/withdrawals', data),
  get: (id) => apiClient.get(`/withdrawals/${id}`)
};

export const vendorSubscriptionsAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/vendor-subscriptions?${query}`);
  },
  get: (id) => apiClient.get(`/vendor-subscriptions/${id}`),
  create: (data) => apiClient.post('/vendor-subscriptions', data),
  update: (id, data) => apiClient.put(`/vendor-subscriptions/${id}`, data),
};

export const shippingZonesAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/shipping-zones?${query}`);
  },
  get: (id) => apiClient.get(`/shipping-zones/${id}`),
  create: (data) => apiClient.post('/shipping-zones', data),
  update: (id, data) => apiClient.put(`/shipping-zones/${id}`, data),
  delete: (id) => apiClient.delete(`/shipping-zones/${id}`)
};

export const couponsAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/coupons?${query}`);
  },
  get: (id) => apiClient.get(`/coupons/${id}`),
  check: (code) => apiClient.get(`/coupons/check/${code}`),
};

export const aiAPI = {
  chat: (prompt) => apiClient.post('/ai/chat', { prompt }),
  generateProductContent: (data) => apiClient.post('/ai/generate-product-content', data),
  generateSentimentSummary: (data) => apiClient.post('/ai/generate-sentiment-summary', data),
  translate: (data) => apiClient.post('/ai/translate', data),
};

export const sentimentAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/sentiment-summaries?${query}`);
  },
  get: (id) => apiClient.get(`/sentiment-summaries/${id}`),
  create: (data) => apiClient.post('/sentiment-summaries', data),
  update: (id, data) => apiClient.put(`/sentiment-summaries/${id}`, data),
  delete: (id) => apiClient.delete(`/sentiment-summaries/${id}`),
};

export const liveChatMessagesAPI = {
  list: (sessionId, filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/live-chat-messages?session_id=${sessionId}&${query}`);
  },
  create: (data) => apiClient.post('/live-chat-messages', data),
};

export default apiClient;
