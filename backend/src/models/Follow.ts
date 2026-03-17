import mongoose, { Document, Schema } from 'mongoose';

export interface IFollow extends Document {
  _id: mongoose.Types.ObjectId;
  follower_email: string;
  following_email: string;
  follow_type: 'user' | 'store' | 'community';
  target_id?: string;
  created_at: Date;
}

const FollowSchema = new Schema<IFollow>({
  follower_email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  following_email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  follow_type: {
    type: String,
    required: true,
    enum: ['user', 'store', 'community'],
    default: 'user',
  },
  target_id: {
    type: String,
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: false, // Follows don't need updated_at
  },
});

// Compound indexes for performance and uniqueness
FollowSchema.index({ follower_email: 1, following_email: 1, follow_type: 1 }, { unique: true });
FollowSchema.index({ following_email: 1, follow_type: 1, created_at: -1 });
FollowSchema.index({ follower_email: 1, created_at: -1 });

export const Follow = mongoose.model<IFollow>('Follow', FollowSchema);