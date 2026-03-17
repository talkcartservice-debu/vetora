import mongoose, { Document, Schema } from 'mongoose';

export interface ILiveChatMessage extends Document {
  _id: mongoose.Types.ObjectId;
  session_id: string;
  user_email: string;
  user_name?: string;
  content: string;
  message_type: 'chat' | 'purchase' | 'join' | 'like';
  product_id?: string;
  product_title?: string;
  created_at: Date;
}

const LiveChatMessageSchema = new Schema<ILiveChatMessage>({
  session_id: {
    type: String,
    required: true,
  },
  user_email: {
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
    enum: ['chat', 'purchase', 'join', 'like'],
    default: 'chat',
  },
  product_id: {
    type: String,
  },
  product_title: {
    type: String,
    trim: true,
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: false, // Chat messages don't need updated_at
  },
});

// Indexes for performance
LiveChatMessageSchema.index({ session_id: 1, created_at: 1 });
LiveChatMessageSchema.index({ user_email: 1 });
LiveChatMessageSchema.index({ message_type: 1 });

export const LiveChatMessage = mongoose.model<ILiveChatMessage>('LiveChatMessage', LiveChatMessageSchema);