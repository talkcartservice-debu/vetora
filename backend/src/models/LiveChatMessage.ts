import mongoose, { Document, Schema } from 'mongoose';

export interface ILiveChatMessage extends Document {
  _id: mongoose.Types.ObjectId;
  session_id: string;
  user_username: string;
  user_name?: string;
  content: string;
  message_type: 'chat' | 'purchase' | 'join' | 'like' | 'pin' | 'unpin' | 'system';
  product_id?: string;
  product_title?: string;
  is_pinned: boolean;
  likes_count: number;
  reply_to?: string; // ID of the message being replied to
  is_deleted: boolean;
  deleted_by?: string; // username of the moderator who deleted it
  created_at: Date;
}

const LiveChatMessageSchema = new Schema<ILiveChatMessage>({
  session_id: {
    type: String,
    required: true,
  },
  user_username: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  user_name: {
    type: String,
    trim: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
  },
  message_type: {
    type: String,
    required: true,
    enum: ['chat', 'purchase', 'join', 'like', 'pin', 'unpin', 'system'],
    default: 'chat',
  },
  product_id: {
    type: String,
  },
  product_title: {
    type: String,
    trim: true,
  },
  is_pinned: {
    type: Boolean,
    default: false,
  },
  likes_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  reply_to: {
    type: Schema.Types.ObjectId,
    ref: 'LiveChatMessage',
  },
  is_deleted: {
    type: Boolean,
    default: false,
  },
  deleted_by: {
    type: String,
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: false,
  },
});

// Indexes for performance
LiveChatMessageSchema.index({ session_id: 1, created_at: 1 });
LiveChatMessageSchema.index({ session_id: 1, is_pinned: 1 });
LiveChatMessageSchema.index({ user_username: 1 });
LiveChatMessageSchema.index({ message_type: 1 });
LiveChatMessageSchema.index({ reply_to: 1 });

export const LiveChatMessage = mongoose.model<ILiveChatMessage>('LiveChatMessage', LiveChatMessageSchema);