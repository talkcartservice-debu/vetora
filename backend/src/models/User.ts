import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  password?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  banner_url?: string;
  is_verified: boolean;
  reset_token?: string;
  reset_token_expiry?: Date;
  created_at: Date;
  updated_at: Date;
}

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    select: false,
  },
  display_name: {
    type: String,
    trim: true,
    maxlength: 50,
  },
  bio: {
    type: String,
    maxlength: 500,
  },
  avatar_url: {
    type: String,
  },
  banner_url: {
    type: String,
  },
  is_verified: {
    type: Boolean,
    default: false,
  },
  reset_token: {
    type: String,
    select: false,
  },
  reset_token_expiry: {
    type: Date,
    select: false,
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

// Indexes for performance
UserSchema.index({ created_at: -1 });

export const User = mongoose.model<IUser>('User', UserSchema);