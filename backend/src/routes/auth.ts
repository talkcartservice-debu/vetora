import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { generateSecret, verify, generateURI } from 'otplib';
import QRCode from 'qrcode';
import { randomInt, randomBytes } from 'crypto';
import { User } from '../models/User';
import { sendVerificationCode, sendWhatsAppVerification } from '../services/mailService';

const loginSchema = z.object({
  email: z.string().min(3), // Could be email or username
  password: z.string().min(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
  password: z.string().min(6),
  display_name: z.string().min(1).max(50).optional(),
});

export async function authRoutes(fastify: FastifyInstance) {
  // Login
  fastify.post('/login', async (request, reply) => {
    try {
      const { email: identifier, password } = loginSchema.parse(request.body);

      // Support login by email OR username
      const user = await User.findOne({ 
        $or: [
          { email: identifier.toLowerCase() }, 
          { username: identifier.toLowerCase() }
        ] 
      }).select('+password +two_factor_secret');

      if (!user) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password || '');
      if (!isValid) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      if (user.is_blocked) {
        return reply.code(403).send({ error: 'Your account has been suspended' });
      }

      if (user.is_2fa_enabled) {
        // Generate a temporary token for 2FA challenge (5 mins expiry)
        const twoFactorToken = fastify.jwt.sign({
          userId: user._id.toString(),
          pending_2fa: true,
        }, { expiresIn: '5m' });

        return { 
          two_factor_required: true,
          two_factor_token: twoFactorToken,
        };
      }

      // Generate JWT token
      const token = fastify.jwt.sign({
        userId: user._id.toString(),
        email: user.email,
        username: user.username,
        role: user.role,
      });

      return {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          banner_url: user.banner_url,
          role: user.role,
          is_blocked: user.is_blocked,
          is_verified: user.is_verified,
          is_2fa_enabled: user.is_2fa_enabled,
          phone_number: user.phone_number,
          is_phone_verified: user.is_phone_verified,
          notifications: user.notifications,
          preferences: user.preferences,
        },
        token,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      
      const err = error as any;
      fastify.log.error(err);
      
      const errorMessage = process.env.NODE_ENV === 'development' 
        ? err.message || err.errmsg || String(err) || 'Internal server error'
        : 'Internal server error';
      
      return reply.code(500).send({ 
        error: errorMessage,
        message: errorMessage, // Support both formats
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
  });

  // Verify 2FA during Login
  fastify.post('/login/2fa', async (request, reply) => {
    try {
      const { two_factor_token, token: otpToken } = z.object({
        two_factor_token: z.string(),
        token: z.string().length(6),
      }).parse(request.body);

      // Verify the 2FA challenge token
      const decoded = fastify.jwt.verify(two_factor_token) as { userId: string, pending_2fa: boolean };
      
      if (!decoded.pending_2fa) {
        return reply.code(400).send({ error: 'Invalid challenge' });
      }

      const user = await User.findById(decoded.userId).select('+two_factor_secret');

      if (!user || !user.two_factor_secret) {
        return reply.code(400).send({ error: 'Invalid request' });
      }

      if (user.is_blocked) {
        return reply.code(403).send({ error: 'Your account has been suspended' });
      }

      const { valid: isValid } = await verify({ 
        token: otpToken, 
        secret: user.two_factor_secret 
      });

      if (!isValid) {
        return reply.code(401).send({ error: 'Invalid 2FA code' });
      }

      // Generate JWT token
      const jwtToken = fastify.jwt.sign({
        userId: user._id.toString(),
        email: user.email,
        username: user.username,
        role: user.role,
      });

      return {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          banner_url: user.banner_url,
          role: user.role,
          is_blocked: user.is_blocked,
          is_verified: user.is_verified,
          is_2fa_enabled: user.is_2fa_enabled,
          phone_number: user.phone_number,
          is_phone_verified: user.is_phone_verified,
          notifications: user.notifications,
          preferences: user.preferences,
        },
        token: jwtToken,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Register
  fastify.post('/register', async (request, reply) => {
    try {
      const body = request.body;
      
      const { email, username, password, display_name } = registerSchema.parse(body);

      // Check if user already exists
      const existingUser = await User.findOne({ 
        $or: [{ email }, { username: username || '' }] 
      });
      if (existingUser) {
        return reply.code(409).send({ error: 'User or email already exists' });
      }

      // Generate username if not provided
      let finalUsername = username;
      if (!finalUsername) {
        finalUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
        // Ensure uniqueness
        let count = 0;
        let candidate = finalUsername;
        while (await User.findOne({ username: candidate })) {
          count++;
          candidate = `${finalUsername}${count}`;
        }
        finalUsername = candidate;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const user = new User({
        email,
        username: finalUsername,
        password: hashedPassword,
        display_name,
        is_verified: false
      });

      await user.save();

      // Generate JWT token
      const token = fastify.jwt.sign({
        userId: user._id.toString(),
        email: user.email,
        username: user.username,
        role: user.role,
      });

      return {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          banner_url: user.banner_url,
          role: user.role,
          is_blocked: user.is_blocked,
          is_verified: user.is_verified,
          is_2fa_enabled: user.is_2fa_enabled,
          phone_number: user.phone_number,
          is_phone_verified: user.is_phone_verified,
          notifications: user.notifications,
          preferences: user.preferences,
        },
        token,
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      
      fastify.log.error('Registration Error:', error);

      // Check for connection errors specifically
      if (error.name === 'MongooseServerSelectionError' || error.name === 'MongooseError' || error.message?.includes('ECONNREFUSED') || error.message?.includes('buffering timed out')) {
        return reply.code(503).send({ 
          error: 'Database connection error. Please ensure MongoDB is running.',
          message: 'Database connection error'
        });
      }
      
      const errorMessage = process.env.NODE_ENV === 'development' 
        ? (error?.message || error?.errmsg || JSON.stringify(error))
        : 'Internal server error';
      
      return reply.code(500).send({ 
        error: errorMessage,
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? (error?.stack || error) : undefined,
        raw: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  });

  // Forgot Password
  fastify.post('/forgot-password', async (request, reply) => {
    try {
      const { email: identifier } = z.object({ email: z.string().min(3) }).parse(request.body);
      const user = await User.findOne({ 
        $or: [
          { email: identifier.toLowerCase() },
          { username: identifier.toLowerCase() }
        ]
      });

      if (!user || !user.email) {
        // Return success even if user not found for security
        return { success: true, message: 'If an account exists, a reset link has been sent.' };
      }

      const email = user.email;

      // Generate a secure reset token
      const resetToken = randomBytes(32).toString('hex').slice(0, 12).toUpperCase();
      user.reset_token = resetToken;
      user.reset_token_expiry = new Date(Date.now() + 3600000); // 1 hour
      await user.save();

      // Mock email sending
      fastify.log.info(`Reset token for ${email}: ${resetToken}`);

      return { 
        success: true, 
        message: 'If an account exists, a reset link has been sent.',
        // For development, we return the token
        ...(process.env.NODE_ENV === 'development' ? { dev_token: resetToken } : {})
      };
    } catch (error) {
      return reply.code(400).send({ error: 'Invalid request' });
    }
  });

  // Reset Password
  fastify.post('/reset-password', async (request, reply) => {
    try {
      const { token, newPassword } = z.object({ 
        token: z.string(), 
        newPassword: z.string().min(6) 
      }).parse(request.body);

      const user = await User.findOne({ 
        reset_token: token,
        reset_token_expiry: { $gt: new Date() }
      });

      if (!user) {
        return reply.code(400).send({ error: 'Invalid or expired token' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      user.password = hashedPassword;
      user.reset_token = undefined;
      user.reset_token_expiry = undefined;
      await user.save();

      return { success: true, message: 'Password has been reset successfully.' };
    } catch (error) {
      return reply.code(400).send({ error: 'Invalid request' });
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
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        bio: user.bio,
        avatar_url: user.avatar_url,
        banner_url: user.banner_url,
        is_verified: user.is_verified,
        is_2fa_enabled: user.is_2fa_enabled,
        phone_number: user.phone_number,
        is_phone_verified: user.is_phone_verified,
        role: user.role,
        is_blocked: user.is_blocked,
        notifications: user.notifications,
        preferences: user.preferences,
        created_at: user.created_at,
        updated_at: user.updated_at,
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Update user profile
  fastify.patch('/me', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const updateSchema = z.object({
      username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
      display_name: z.string().max(50).optional(),
      bio: z.string().max(500).optional(),
      avatar_url: z.string().optional(),
      banner_url: z.string().optional(),
      notifications: z.object({
        notif_sales: z.boolean().optional(),
        notif_msg: z.boolean().optional(),
        notif_follow: z.boolean().optional(),
        notif_live: z.boolean().optional(),
      }).optional(),
      preferences: z.object({
        theme: z.enum(['light', 'dark']).optional(),
        language: z.string().optional(),
      }).optional(),
    });

    try {
      const updateData = updateSchema.parse(request.body);
      const { userId } = request.user as { userId: string };

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
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        bio: user.bio,
        avatar_url: user.avatar_url,
        banner_url: user.banner_url,
        is_verified: user.is_verified,
        is_2fa_enabled: user.is_2fa_enabled,
        phone_number: user.phone_number,
        is_phone_verified: user.is_phone_verified,
        role: user.role,
        is_blocked: user.is_blocked,
        notifications: user.notifications,
        preferences: user.preferences,
        created_at: user.created_at,
        updated_at: user.updated_at,
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Update password
  fastify.post('/change-password', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { currentPassword, newPassword } = z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(6),
      }).parse(request.body);

      const { userId } = request.user as { userId: string };
      const user = await User.findById(userId).select('+password');

      if (!user || !user.password) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return reply.code(400).send({ error: 'Invalid current password' });
      }

      user.password = await bcrypt.hash(newPassword, 12);
      await user.save();

      return { success: true, message: 'Password updated successfully' };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update email (Step 1: Send verification code)
  fastify.post('/change-email', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { newEmail, password } = z.object({
        newEmail: z.string().email(),
        password: z.string(),
      }).parse(request.body);

      const { userId } = request.user as { userId: string };
      const user = await User.findById(userId).select('+password');

      if (!user || !user.password) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return reply.code(400).send({ error: 'Invalid password' });
      }

      // Check if new email already exists
      const existingUser = await User.findOne({ email: newEmail });
      if (existingUser) {
        return reply.code(409).send({ error: 'Email already in use' });
      }

      // Generate 6-digit code
      const code = randomInt(100000, 1000000).toString();
      user.email_verification_code = code;
      user.email_verification_expiry = new Date(Date.now() + 15 * 60000); // 15 mins
      await user.save();

      // Send email
      await sendVerificationCode(newEmail, code);

      return { success: true, message: 'Verification code sent to your new email' };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Verify and update email (Step 2)
  fastify.post('/verify-email', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { newEmail, token } = z.object({
        newEmail: z.string().email(),
        token: z.string().length(6),
      }).parse(request.body);

      const { userId } = request.user as { userId: string };
      const user = await User.findById(userId).select('+email_verification_code +email_verification_expiry');

      if (!user || !user.email_verification_code) {
        return reply.code(400).send({ error: 'No verification pending' });
      }

      if (user.email_verification_code !== token) {
        return reply.code(400).send({ error: 'Invalid verification code' });
      }

      if (user.email_verification_expiry && user.email_verification_expiry < new Date()) {
        return reply.code(400).send({ error: 'Verification code expired' });
      }

      user.email = newEmail;
      user.email_verification_code = undefined;
      user.email_verification_expiry = undefined;
      user.is_verified = true; // Mark as verified since they just proved they own the email
      await user.save();

      return { success: true, message: 'Email updated and verified successfully' };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update phone (Step 1: Send verification code via WhatsApp/SMS)
  fastify.post('/change-phone', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { newPhone } = z.object({
        newPhone: z.string().min(10),
      }).parse(request.body);

      const { userId } = request.user as { userId: string };
      const user = await User.findById(userId);

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Check if new phone already exists
      const existingUser = await User.findOne({ phone_number: newPhone });
      if (existingUser && existingUser._id.toString() !== userId) {
        return reply.code(409).send({ error: 'Phone number already in use' });
      }

      // Generate 6-digit code
      const code = randomInt(100000, 1000000).toString();
      user.phone_verification_code = code;
      user.phone_verification_expiry = new Date(Date.now() + 15 * 60000); // 15 mins
      await user.save();

      // Send WhatsApp/SMS
      await sendWhatsAppVerification(newPhone, code);

      return { success: true, message: 'Verification code sent to your phone' };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Verify and update phone (Step 2)
  fastify.post('/verify-phone', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { newPhone, token } = z.object({
        newPhone: z.string().min(10),
        token: z.string().length(6),
      }).parse(request.body);

      const { userId } = request.user as { userId: string };
      const user = await User.findById(userId).select('+phone_verification_code +phone_verification_expiry');

      if (!user || !user.phone_verification_code) {
        return reply.code(400).send({ error: 'No verification pending' });
      }

      if (user.phone_verification_code !== token) {
        return reply.code(400).send({ error: 'Invalid verification code' });
      }

      if (user.phone_verification_expiry && user.phone_verification_expiry < new Date()) {
        return reply.code(400).send({ error: 'Verification code expired' });
      }

      user.phone_number = newPhone;
      user.phone_verification_code = undefined;
      user.phone_verification_expiry = undefined;
      user.is_phone_verified = true;
      await user.save();

      return { success: true, message: 'Phone number updated and verified successfully' };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Setup 2FA
  fastify.post('/2fa/setup', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { userId } = request.user as { userId: string };
      const user = await User.findById(userId);

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Generate a new secret and save it to the user
      const secret = generateSecret();
      user.two_factor_secret = secret;
      await user.save();

      const otpauth = generateURI({ secret, label: user.email, issuer: 'Vetora' });
      const qrCode = await QRCode.toDataURL(otpauth);

      return { secret, qrCode };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Enable 2FA
  fastify.post('/2fa/enable', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { token } = z.object({
        token: z.string().length(6),
      }).parse(request.body);

      const { userId } = request.user as { userId: string };
      const user = await User.findById(userId).select('+two_factor_secret');

      if (!user || !user.two_factor_secret) {
        return reply.code(400).send({ error: '2FA setup not initiated' });
      }

      const { valid: isValid } = await verify({ 
        token, 
        secret: user.two_factor_secret 
      });

      if (!isValid) {
        return reply.code(400).send({ error: 'Invalid verification code' });
      }

      user.is_2fa_enabled = true;
      await user.save();

      return { success: true, message: '2FA enabled successfully' };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Disable 2FA
  fastify.post('/2fa/disable', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { token } = z.object({
        token: z.string().length(6),
      }).parse(request.body);

      const { userId } = request.user as { userId: string };
      const user = await User.findById(userId).select('+two_factor_secret');

      if (!user || !user.two_factor_secret) {
        return reply.code(400).send({ error: '2FA is not enabled' });
      }

      const { valid: isValid } = await verify({ 
        token, 
        secret: user.two_factor_secret 
      });

      if (!isValid) {
        return reply.code(400).send({ error: 'Invalid verification code' });
      }

      user.two_factor_secret = undefined;
      user.is_2fa_enabled = false;
      await user.save();

      return { success: true, message: '2FA disabled successfully' };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
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