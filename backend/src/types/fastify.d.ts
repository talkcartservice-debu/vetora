import { Server as SocketIOServer } from 'socket.io';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
    authenticateOptional: (request: any, reply: any) => Promise<void>;
    io: SocketIOServer | null;
  }

  interface FastifyRequest {
    language: string;
  }
}