import { FastifyInstance } from 'fastify';
import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer;

export function setupWebSocket(fastify: FastifyInstance) {
  // Create Socket.IO server
  io = new SocketIOServer(fastify.server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  // TODO: Add Redis adapter for scaling when needed
  // if (process.env.REDIS_URL) {
  //   const pubClient = createClient({ url: process.env.REDIS_URL });
  //   const subClient = pubClient.duplicate();
  //   io.adapter(createAdapter(pubClient, subClient));
  // }

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      // Verify JWT token
      const decoded = fastify.jwt.verify(token);
      socket.data.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.user.userId;
    console.log(`User ${userId} connected`);

    // Join user-specific room for notifications
    socket.join(`user:${userId}`);

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected`);
    });

    // Example: Join conversation room
    socket.on('join-conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    // Example: Leave conversation room
    socket.on('leave-conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Example: Join live session room
    socket.on('join-live-session', (sessionId: string) => {
      socket.join(`live-session:${sessionId}`);
    });

    // Example: Leave live session room
    socket.on('leave-live-session', (sessionId: string) => {
      socket.leave(`live-session:${sessionId}`);
    });
  });

  console.log('✅ WebSocket server initialized');
}

export { io };