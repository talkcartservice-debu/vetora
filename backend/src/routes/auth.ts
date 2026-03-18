import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  display_name: z.string().min(1).max(50).optional(),
});

export async function authRoutes(fastify: FastifyInstance) {
  // Login
  fastify.post('/login', async (request, reply) => {
    try {
      const { email, password } = loginSchema.parse(request.body);

      const user = await User.findOne({ email }).select('+password');

      if (!user) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password || '');
      if (!isValid) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      // Generate JWT token
      const token = fastify.jwt.sign({
        userId: user._id,
        email: user.email,
      });

      return {
        user: {
          id: user._id,
          email: user.email,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          banner_url: user.banner_url,
          is_verified: user.is_verified,
        },
        token,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      // Log detailed error for debugging
      const err = error as Error;
      fastify.log.error(err.message || 'Login error');
      
      const errorMessage = process.env.NODE_ENV === 'development' 
        ? err.message || 'Internal server error'
        : 'Internal server error';
      
      return reply.code(500).send({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });

  // Register
  fastify.post('/register', async (request, reply) => {
    console.log('Register endpoint called');
    try {
      const body = request.body;
      console.log('Request body:', body);
      
      const { email, password, display_name } = registerSchema.parse(body);
      console.log('Parsed data:', { email, password, display_name });

      // Check if user already exists
      console.log('Checking if user exists...');
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        console.log('User already exists:', email);
        return reply.code(409).send({ error: 'User already exists' });
      }
      console.log('User does not exist, proceeding...');

      // Hash password
      console.log('Hashing password...');
      const hashedPassword = await bcrypt.hash(password, 12);
      console.log('Password hashed successfully');

      // Create user
      console.log('Creating user object...');
      const user = new User({
        email,
        password: hashedPassword,
        display_name,
        is_verified: false
      });

      console.log('Saving user...');
      await user.save();
      console.log('User created successfully:', user.email);

      // Generate JWT token
      console.log('Generating JWT token...');
      const token = fastify.jwt.sign({
        userId: user._id,
        email: user.email,
      });
      console.log('Token generated successfully');

      return {
        user: {
          id: user._id,
          email: user.email,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          banner_url: user.banner_url,
          is_verified: user.is_verified,
        },
        token,
      };
    } catch (error: any) {
      console.error('=== REGISTRATION ERROR ===');
      console.error('Error type:', error?.constructor?.name);
      console.error('Error message:', error?.message || 'No message');
      console.error('Error stack:', error?.stack || 'No stack');
      console.error('Full error:', JSON.stringify(error, null, 2));
      console.error('========================');
      
      if (error instanceof z.ZodError) {
        console.log('Zod validation error:', error.errors);
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      
      // Return more specific error message in development
      const errorMessage = process.env.NODE_ENV === 'development' 
        ? (error?.message || 'Internal server error')
        : 'Internal server error';
      
      return reply.code(500).send({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      });
    }
  });

  // Get current user (me)
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const user = await User.findById(userId);

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      return {
        id: user._id,
        email: user.email,
        display_name: user.display_name,
        bio: user.bio,
        avatar_url: user.avatar_url,
        banner_url: user.banner_url,
        is_verified: user.is_verified,
        created_at: user.created_at,
        updated_at: user.updated_at,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update user profile
  fastify.patch('/me', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const updateData = request.body as { display_name?: string; bio?: string; avatar_url?: string };
    const { userId } = request.user as { userId: string };

    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { ...updateData, updated_at: new Date() },
        { new: true }
      );

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      return {
        id: user._id,
        email: user.email,
        display_name: user.display_name,
        bio: user.bio,
        avatar_url: user.avatar_url,
        banner_url: user.banner_url,
        is_verified: user.is_verified,
        created_at: user.created_at,
        updated_at: user.updated_at,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Logout (client-side token removal)
  fastify.post('/logout', async (request, reply) => {
    // In a stateless JWT system, logout is handled client-side
    return { success: true };
  });
}