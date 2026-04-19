import { FastifyInstance } from 'fastify';
import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer;

export function setupWebSocket(fastify: FastifyInstance) {
  // Create Socket.IO server
  io = new SocketIOServer(fastify.server, {
    cors: {
      origin: (origin, callback) => {
        const extraOrigins = (process.env.CORS_ORIGINS || '')
          .split(',')
          .map(o => o.trim())
          .filter(Boolean);

        const allowedOrigins = [
          process.env.FRONTEND_URL,
          'http://localhost:5173',
          'http://localhost:3000',
          'http://127.0.0.1:5173',
          ...extraOrigins,
        ].filter(Boolean);

        if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
          callback(null, true);
        } else {
          console.warn(`WebSocket CORS rejected origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
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
    const username = socket.data.user.username;
    console.log(`User ${username || userId} connected`);

    // Join user-specific rooms for notifications and messages
    socket.join(`user:${userId}`);
    if (username) {
      socket.join(`user:${username}`);
    }

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User ${username || userId} disconnected`);
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