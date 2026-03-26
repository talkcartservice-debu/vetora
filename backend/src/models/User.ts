import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  email: string;
  password?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  banner_url?: string;
  is_verified: boolean;
  notifications?: {
    notif_sales: boolean;
    notif_msg: boolean;
    notif_follow: boolean;
    notif_live: boolean;
  };
  preferences?: {
    theme: 'light' | 'dark';
    language: string;
  };
  is_2fa_enabled: boolean;
  two_factor_secret?: string;
  email_verification_code?: string;
  email_verification_expiry?: Date;
  phone_number?: string;
  is_phone_verified: boolean;
  phone_verification_code?: string;
  phone_verification_expiry?: Date;
  reset_token?: string;
  reset_token_expiry?: Date;
  role: 'user' | 'vendor' | 'super_admin';
  is_blocked: boolean;
  follower_count: number;
  following_count: number;
  created_at: Date;
  updated_at: Date;
}

const UserSchema = new Schema<IUser>({
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
  },
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
  notifications: {
    notif_sales: { type: Boolean, default: true },
    notif_msg: { type: Boolean, default: true },
    notif_follow: { type: Boolean, default: true },
    notif_live: { type: Boolean, default: false },
  },
  preferences: {
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    language: { type: String, default: 'en' },
  },
  is_2fa_enabled: {
    type: Boolean,
    default: false,
  },
  two_factor_secret: {
    type: String,
    select: false,
  },
  email_verification_code: {
    type: String,
    select: false,
  },
  email_verification_expiry: {
    type: Date,
    select: false,
  },
  phone_number: {
    type: String,
    trim: true,
  },
  is_phone_verified: {
    type: Boolean,
    default: false,
  },
  phone_verification_code: {
    type: String,
    select: false,
  },
  phone_verification_expiry: {
    type: Date,
    select: false,
  },
  reset_token: {
    type: String,
    select: false,
  },
  reset_token_expiry: {
    type: Date,
    select: false,
  },
  role: {
    type: String,
    enum: ['user', 'vendor', 'super_admin'],
    default: 'user',
  },
  is_blocked: {
    type: Boolean,
    default: false,
  },
  follower_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  following_count: {
    type: Number,
    default: 0,
    min: 0,
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