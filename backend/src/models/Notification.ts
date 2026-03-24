import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  recipient_email: string;
  type: 'like' | 'comment' | 'follow' | 'order_update' | 'message' | 'mention' | 'community' | 'promotion' | 'offer';
  title: string;
  body?: string;
  link?: string;
  sender_email?: string;
  sender_name?: string;
  is_read: boolean;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

const NotificationSchema = new Schema<INotification>({
  recipient_email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['like', 'comment', 'follow', 'order_update', 'message', 'mention', 'community', 'promotion', 'offer'],
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  body: {
    type: String,
    trim: true,
  },
  link: {
    type: String,
  },
  sender_email: {
    type: String,
    lowercase: true,
    trim: true,
  },
  sender_name: {
    type: String,
    trim: true,
  },
  is_read: {
    type: Boolean,
    default: false,
  },
  metadata: {
    type: Schema.Types.Mixed,
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

// Indexes for performance
NotificationSchema.index({ recipient_email: 1, created_at: -1 });
NotificationSchema.index({ recipient_email: 1, is_read: 1 });
NotificationSchema.index({ type: 1 });
NotificationSchema.index({ sender_email: 1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);