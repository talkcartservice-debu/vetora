import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { connectDB } from './config/database';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { productRoutes } from './routes/products';
import { orderRoutes } from './routes/orders';
import { messageRoutes } from './routes/messages';
import { notificationRoutes } from './routes/notifications';
import { communityRoutes } from './routes/communities';
import { liveSessionRoutes } from './routes/liveSessions';
import { storeRoutes } from './routes/stores';
import { reviewRoutes } from './routes/reviews';
import { commentRoutes } from './routes/comments';
import { likeRoutes } from './routes/likes';
import { liveChatMessageRoutes } from './routes/liveChatMessages';
import { followRoutes } from './routes/follows';
import { communityMemberRoutes } from './routes/communityMembers';
import { couponRoutes } from './routes/coupons';
import { affiliateLinkRoutes } from './routes/affiliateLinks';
import { postRoutes } from './routes/posts';
import { cartRoutes } from './routes/cart';
import { fileRoutes } from './routes/files';
import { aiRoutes } from './routes/ai';
import { paymentRoutes } from './routes/payments';
import { storyRoutes } from './routes/stories';
import { sentimentSummaryRoutes } from './routes/sentimentSummaries';
import { shippingZoneRoutes } from './routes/shippingZones';
import { storeReviewRoutes } from './routes/storeReviews';
import { vendorSubscriptionRoutes } from './routes/vendorSubscriptions';
import { withdrawalRoutes } from './routes/withdrawals';
import { wishlistRoutes } from './routes/wishlist';
import { bookmarkRoutes } from './routes/bookmarks';
import { setupWebSocket, io } from './websocket/socket';
import { authenticate } from './middleware/auth';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
  bodyLimit: 50 * 1024 * 1024, // 50MB limit for file uploads
});

// Environment variables
const PORT = parseInt(process.env.PORT || '4000');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Register plugins
fastify.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
});

fastify.register(jwt, {
  secret: JWT_SECRET,
});

// Add authentication decorator
fastify.decorate('authenticate', authenticate);

// Add Socket.IO decorator
fastify.decorate('io', null);

// Connect to database
connectDB();

// Register routes
fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(userRoutes, { prefix: '/api/users' });
fastify.register(productRoutes, { prefix: '/api/products' });
fastify.register(orderRoutes, { prefix: '/api/orders' });
fastify.register(messageRoutes, { prefix: '/api/messages' });
fastify.register(notificationRoutes, { prefix: '/api/notifications' });
fastify.register(communityRoutes, { prefix: '/api/communities' });
fastify.register(liveSessionRoutes, { prefix: '/api/live-sessions' });
fastify.register(storeRoutes, { prefix: '/api/stores' });
fastify.register(reviewRoutes, { prefix: '/api/reviews' });
fastify.register(commentRoutes, { prefix: '/api/comments' });
fastify.register(likeRoutes, { prefix: '/api/likes' });
fastify.register(liveChatMessageRoutes, { prefix: '/api/live-chat-messages' });
fastify.register(followRoutes, { prefix: '/api/follows' });
fastify.register(communityMemberRoutes, { prefix: '/api/community-members' });
fastify.register(couponRoutes, { prefix: '/api/coupons' });
fastify.register(affiliateLinkRoutes, { prefix: '/api/affiliate-links' });
fastify.register(postRoutes, { prefix: '/api/posts' });
fastify.register(cartRoutes, { prefix: '/api/cart' });
fastify.register(fileRoutes, { prefix: '/api/files' });
fastify.register(aiRoutes, { prefix: '/api/ai' });
fastify.register(paymentRoutes, { prefix: '/api/payments' });
fastify.register(storyRoutes, { prefix: '/api/stories' });
fastify.register(sentimentSummaryRoutes, { prefix: '/api/sentiment-summaries' });
fastify.register(shippingZoneRoutes, { prefix: '/api/shipping-zones' });
fastify.register(storeReviewRoutes, { prefix: '/api/store-reviews' });
fastify.register(vendorSubscriptionRoutes, { prefix: '/api/vendor-subscriptions' });
fastify.register(withdrawalRoutes, { prefix: '/api/withdrawals' });
fastify.register(wishlistRoutes, { prefix: '/api/wishlist' });
fastify.register(bookmarkRoutes, { prefix: '/api/bookmarks' });

// Setup WebSocket
setupWebSocket(fastify);

// Set the io instance on fastify
fastify.io = io;

// Health check
fastify.get('/api/health', async () => {
  return { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    restart_sync: "2026-03-20T18:30:00Z" // Force tsx watch to reload .env
  };
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();