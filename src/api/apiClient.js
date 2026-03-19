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
    // Prevent common bugs by checking for 'undefined' or 'null' in the URL
    // We check for both string and actual values
    if (typeof endpoint !== 'string' || endpoint.includes('undefined') || endpoint.includes('null')) {
      console.warn(`API Client: Blocked request to invalid endpoint: ${endpoint}`);
      throw new Error(`Invalid API endpoint: ${endpoint}`);
    }

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
      error.details = data?.details; // Save validation details
      
      if (!response.ok) {
        // Detailed validation error logging
        if (data?.details && Array.isArray(data.details)) {
          const detailStr = data.details.map(d => `${d.path.join('.')}: ${d.message}`).join(', ');
          console.error(`API Validation Error [${endpoint}]: ${detailStr}`, data.details);
        } else if (response.status !== 404) {
          console.error(`API Error [${endpoint}]: ${error.message}`, error);
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
  delete(endpoint, body = null, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE', body });
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

export const followsAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/follows?${query}`);
  },
  follow: (followingEmail, followType = 'user', targetId = null) => 
    apiClient.post('/follows', { following_email: followingEmail, follow_type: followType, target_id: targetId }),
  unfollow: (params) => {
    const query = apiClient.buildQueryString(params);
    return apiClient.delete(`/follows?${query}`);
  },
  check: (params) => {
    const query = apiClient.buildQueryString(params);
    return apiClient.get(`/follows/check?${query}`);
  },
  getFollowers: (params) => {
    const query = apiClient.buildQueryString(params);
    return apiClient.get(`/follows/followers?${query}`);
  },
  getFollowing: (params) => {
    const query = apiClient.buildQueryString(params);
    return apiClient.get(`/follows/following?${query}`);
  },
  getCounts: (params) => {
    const query = apiClient.buildQueryString(params);
    return apiClient.get(`/follows/counts?${query}`);
  },
  getMyFollowing: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/follows/me/following?${query}`);
  },
  getMyFollowers: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/follows/me/followers?${query}`);
  }
};

export const followAPI = followsAPI;

export const productsAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/products?${query}`);
  },
  get: (id) => apiClient.get(`/products/${id}`),
  create: (data) => apiClient.post('/products', data),
  update: (id, data) => apiClient.patch(`/products/${id}`, data),
  delete: (id) => apiClient.delete(`/products/${id}`),
  search: (query) => apiClient.get(`/products/search?q=${encodeURIComponent(query)}`),
  getTopSelling: (limit = 10) => apiClient.get(`/products/top-selling?limit=${limit}`),
  getRelated: (id, limit = 10) => apiClient.get(`/products/related/${id}?limit=${limit}`),
  getRecommendations: (limit = 10) => apiClient.get(`/products/recommendations?limit=${limit}`),
};

export const ordersAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/orders?${query}`);
  },
  get: (id) => apiClient.get(`/orders/${id}`),
  create: (data) => apiClient.post('/orders', data),
  updateStatus: (id, status) => apiClient.patch(`/orders/${id}/status`, { status }),
  cancelOrder: (id) => apiClient.patch(`/orders/${id}/status`, { status: 'cancelled' })
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
  update: (id, data) => apiClient.patch(`/posts/${id}`, data),
  delete: (id) => apiClient.delete(`/posts/${id}`),
  like: (id) => apiClient.post(`/posts/${id}/like`, {}),
  unlike: (id) => apiClient.delete(`/posts/${id}/like`),
  share: (id) => apiClient.patch(`/posts/${id}`, { $inc: { shares_count: 1 } }), // Direct increment for simplicity
};

export const bookmarksAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/bookmarks?${query}`);
  },
  check: (targetType, targetId) => apiClient.get(`/bookmarks/check?target_type=${targetType}&target_id=${targetId}`),
  add: (data) => apiClient.post('/bookmarks', data),
  remove: (targetType, targetId) => apiClient.delete(`/bookmarks?target_type=${targetType}&target_id=${targetId}`),
};

export const commentsAPI = {
  list: (postId, filters = {}) => {
    const query = apiClient.buildQueryString({ ...filters, post_id: postId });
    return apiClient.get(`/comments?${query}`);
  },
  get: (id) => apiClient.get(`/comments/${id}`),
  getThread: (id) => apiClient.get(`/comments/${id}/thread`),
  create: (data) => apiClient.post('/comments', data),
  update: (id, data) => apiClient.put(`/comments/${id}`, data),
  delete: (id) => apiClient.delete(`/comments/${id}`),
  like: (id) => apiClient.post(`/comments/${id}/like`, {}),
};

export const likesAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/likes?${query}`);
  },
  check: (targetType, targetId) => apiClient.get(`/likes/check?target_type=${targetType}&target_id=${targetId}`),
  like: (targetType, targetId) => apiClient.post('/likes', { target_type: targetType, target_id: targetId }),
  unlike: (targetType, targetId) => apiClient.delete(`/likes?target_type=${targetType}&target_id=${targetId}`),
  getCount: (targetType, targetId) => apiClient.get(`/likes/count?target_type=${targetType}&target_id=${targetId}`),
  getUserLikes: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/likes/user?${query}`);
  }
};

export const withdrawalsAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/withdrawals?${query}`);
  },
  get: (id) => apiClient.get(`/withdrawals/${id}`),
  getByVendor: (vendorEmail, filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/withdrawals/vendor/${vendorEmail}?${query}`);
  },
  create: (data) => apiClient.post('/withdrawals', data),
  update: (id, data) => apiClient.put(`/withdrawals/${id}`, data),
  updateStatus: (id, data) => apiClient.put(`/withdrawals/${id}/status`, data),
  delete: (id) => apiClient.delete(`/withdrawals/${id}`),
  getOverview: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/withdrawals/stats/overview?${query}`);
  },
};

export const vendorSubscriptionsAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/vendor-subscriptions?${query}`);
  },
  get: (id) => apiClient.get(`/vendor-subscriptions/${id}`),
  getByVendor: (vendorEmail) => apiClient.get(`/vendor-subscriptions/vendor/${vendorEmail}`),
  getByStore: (storeId) => apiClient.get(`/vendor-subscriptions/store/${storeId}`),
  create: (data) => apiClient.post('/vendor-subscriptions', data),
  update: (id, data) => apiClient.put(`/vendor-subscriptions/${id}`, data),
  cancel: (id) => apiClient.post(`/vendor-subscriptions/${id}/cancel`, {}),
  renew: (id) => apiClient.post(`/vendor-subscriptions/${id}/renew`, {}),
  delete: (id) => apiClient.delete(`/vendor-subscriptions/${id}`),
  getStatus: (id) => apiClient.get(`/vendor-subscriptions/${id}/status`),
  getPlans: () => apiClient.get('/vendor-subscriptions/public/plans'),
};

export const shippingZonesAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/shipping-zones?${query}`);
  },
  get: (id) => apiClient.get(`/shipping-zones/${id}`),
  getByVendor: (vendorEmail) => apiClient.get(`/shipping-zones/vendor/${vendorEmail}`),
  getByStore: (storeId) => apiClient.get(`/shipping-zones/store/${storeId}`),
  create: (data) => apiClient.post('/shipping-zones', data),
  update: (id, data) => apiClient.put(`/shipping-zones/${id}`, data),
  delete: (id) => apiClient.delete(`/shipping-zones/${id}`),
  calculate: (id, data) => apiClient.post(`/shipping-zones/${id}/calculate`, data),
  getAvailable: (countryCode, filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/shipping-zones/available/${countryCode}?${query}`);
  },
};

export const storesAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/stores?${query}`);
  },
  get: (id) => apiClient.get(`/stores/${id}`),
  create: (data) => apiClient.post('/stores', data),
  update: (id, data) => apiClient.patch(`/stores/${id}`, data),
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
  getByName: (name) => apiClient.get(`/communities/name/${name}`),
  create: (data) => apiClient.post('/communities', data),
  update: (id, data) => apiClient.put(`/communities/${id}`, data),
  delete: (id) => apiClient.delete(`/communities/${id}`),
  listForMe: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/communities/user/me?${query}`);
  },
  join: (id) => apiClient.post(`/communities/${id}/join`, {}),
  leave: (id) => apiClient.post(`/communities/${id}/leave`, {})
};

export const communityMembersAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/community-members?${query}`);
  },
  create: (data) => apiClient.post('/community-members', data),
  update: (id, data) => apiClient.put(`/community-members/${id}`, data),
  delete: (id) => apiClient.delete(`/community-members/${id}`),
  check: (communityId) => apiClient.get(`/community-members/check?community_id=${communityId}`),
  getMe: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/community-members/me?${query}`);
  },
  bulkAdd: (data) => apiClient.post('/community-members/bulk', data)
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
  update: (productId, data) => apiClient.put(`/wishlist/${productId}`, data),
  remove: (productId) => apiClient.delete(`/wishlist/${productId}`),
  getStats: () => apiClient.get('/wishlist/stats'),
  bulkAdd: (data) => apiClient.post('/wishlist/bulk', data),
  clear: () => apiClient.delete('/wishlist'),
  getPopular: (limit = 20) => apiClient.get(`/wishlist/popular/items?limit=${limit}`)
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
  markHelpful: (id) => apiClient.post(`/reviews/${id}/helpful`, {}),
  getSummary: (productId) => apiClient.get(`/reviews/product/${productId}/summary`),
};

export const storeReviewsAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/store-reviews?${query}`);
  },
  get: (id) => apiClient.get(`/store-reviews/${id}`),
  getByStore: (storeId, filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/store-reviews/store/${storeId}?${query}`);
  },
  getByReviewer: (reviewerEmail) => apiClient.get(`/store-reviews/reviewer/${reviewerEmail}`),
  create: (data) => apiClient.post('/store-reviews', data),
  update: (id, data) => apiClient.put(`/store-reviews/${id}`, data),
  reply: (id, replyText) => apiClient.post(`/store-reviews/${id}/reply`, { reply: replyText }),
  markHelpful: (id) => apiClient.post(`/store-reviews/${id}/helpful`, {}),
  delete: (id) => apiClient.delete(`/store-reviews/${id}`),
  getStats: (storeId) => apiClient.get(`/store-reviews/stats/${storeId}`),
};

export const storiesAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/stories?${query}`);
  },
  get: (id) => apiClient.get(`/stories/${id}`),
  getByUser: (email) => apiClient.get(`/stories/user/${email}`),
  getMe: () => apiClient.get('/stories/user/me'),
  getFeed: () => apiClient.get('/stories/feed'),
  create: (data) => apiClient.post('/stories', data),
  update: (id, data) => apiClient.put(`/stories/${id}`, data),
  view: (id) => apiClient.post(`/stories/${id}/view`, {}),
  like: (id) => apiClient.post(`/stories/${id}/like`, {}),
  reply: (id, text) => apiClient.post(`/stories/${id}/reply`, { text }),
  delete: (id) => apiClient.delete(`/stories/${id}`),
  cleanup: () => apiClient.post('/stories/cleanup', {})
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
  end: (id) => apiClient.post(`/live-sessions/${id}/end`, {}),
  updateViewers: (id, count) => apiClient.post(`/live-sessions/${id}/viewers`, { count }),
  like: (id) => apiClient.post(`/live-sessions/${id}/like`, {}),
  delete: (id) => apiClient.delete(`/live-sessions/${id}`),
  listForMe: (status = null) => {
    const query = apiClient.buildQueryString({ status });
    return apiClient.get(`/live-sessions/user/me?${query}`);
  }
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
  getByRefCode: (refCode) => apiClient.get(`/affiliate-links/ref/${refCode}`),
  create: (data) => apiClient.post('/affiliate-links', data),
  update: (id, data) => apiClient.put(`/affiliate-links/${id}`, data),
  delete: (id) => apiClient.delete(`/affiliate-links/${id}`),
  trackClick: (refCode) => apiClient.post(`/affiliate-links/ref/${refCode}/click`, {}),
  trackConversion: (refCode, data) => apiClient.post(`/affiliate-links/ref/${refCode}/convert`, data),
  listForMe: (filters = {}) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/affiliate-links/influencer/me?${query}`);
  },
  listByProduct: (productId, filters = {}) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/affiliate-links/product/${productId}?${query}`);
  }
};

export const couponsAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/coupons?${query}`);
  },
  get: (id) => apiClient.get(`/coupons/${id}`),
  getByCode: (code) => apiClient.get(`/coupons/code/${code}`),
  create: (data) => apiClient.post('/coupons', data),
  update: (id, data) => apiClient.put(`/coupons/${id}`, data),
  delete: (id) => apiClient.delete(`/coupons/${id}`),
  validate: (data) => apiClient.post('/coupons/validate', data),
  apply: (id) => apiClient.post(`/coupons/${id}/apply`, {}),
  listForVendor: (filters = {}) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get(`/coupons/vendor/me?${query}`);
  }
};

export const aiAPI = {
  invoke: (data) => apiClient.post('/ai/invoke', data),
  generateProductDescription: (data) => apiClient.post('/ai/generate-product-description', data),
  translate: (data) => apiClient.post('/ai/translate', data),
};

export const sentimentAPI = {
  list: (filters) => {
    const query = apiClient.buildQueryString(filters);
    return apiClient.get('/sentiment-summaries?' + query);
  },
  get: (id) => apiClient.get(`/sentiment-summaries/${id}`),
  getByProduct: (productId) => apiClient.get(`/sentiment-summaries/product/${productId}`),
  create: (data) => apiClient.post('/sentiment-summaries', data),
  update: (id, data) => apiClient.put(`/sentiment-summaries/${id}`, data),
  delete: (id) => apiClient.delete(`/sentiment-summaries/${id}`),
  getStats: () => apiClient.get('/sentiment-summaries/stats/overview'),
};

export const liveChatMessagesAPI = {
  list: (sessionId, filters) => {
    const query = apiClient.buildQueryString({ ...filters, session_id: sessionId });
    return apiClient.get(`/live-chat-messages?${query}`);
  },
  send: (data) => apiClient.post('/live-chat-messages', data),
  sendSystem: (data) => apiClient.post('/live-chat-messages/system', data),
  getStats: (sessionId) => apiClient.get(`/live-chat-messages/stats/${sessionId}`),
  delete: (id) => apiClient.delete(`/live-chat-messages/${id}`),
};

export default apiClient;
