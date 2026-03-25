import { FastifyRequest, FastifyReply } from 'fastify';
import { Settings } from '../models/Settings';
import { ActivityLog } from '../models/ActivityLog';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

export async function isAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    const decoded = request.user as any;
    if (decoded.role !== 'super_admin') {
      return reply.code(403).send({ error: 'Forbidden: Admin access required' });
    }
  } catch (err) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

export async function logActivity(request: FastifyRequest, action: string, targetId?: any, targetType?: string, metadata?: any) {
  try {
    const user = request.user as any;
    if (!user) return;

    await ActivityLog.create({
      user_id: user._id,
      action,
      target_id: targetId,
      target_type: targetType,
      metadata,
      ip_address: request.ip
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}

export async function checkMaintenance(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Skip check for login and admin routes
    if (request.url.startsWith('/api/auth') || request.url.startsWith('/api/admin')) {
      return;
    }

    const settings = await Settings.findOne();
    if (settings?.maintenance_mode) {
      // Check if user is super admin
      try {
        await request.jwtVerify();
        const user = request.user as any;
        if (user.role === 'super_admin') {
          return;
        }
      } catch (err) {
        // Not logged in or invalid token - proceed to block
      }
      
      return reply.code(503).send({ 
        error: 'Service Unavailable', 
        message: settings.maintenance_message || 'Vetora is currently under maintenance. Please check back later.',
        maintenance: true
      });
    }
  } catch (err) {
    // If settings check fails, proceed normally
  }
}