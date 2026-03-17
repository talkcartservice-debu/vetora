import mongoose, { Document, Schema } from 'mongoose';

export interface IStore extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  owner_email: string;
  owner_name?: string;
  logo_url?: string;
  banner_url?: string;
  category: string;
  status: 'active' | 'pending' | 'suspended';
  is_verified: boolean;
  follower_count: number;
  product_count: number;
  total_sales: number;
  rating_avg: number;
  created_at: Date;
  updated_at: Date;
}

const StoreSchema = new Schema<IStore>({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  owner_email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  owner_name: {
    type: String,
    trim: true,
  },
  logo_url: {
    type: String,
  },
  banner_url: {
    type: String,
  },
  category: {
    type: String,
    enum: ['fashion', 'electronics', 'home', 'beauty', 'sports', 'food', 'art', 'books', 'handmade', 'other'],
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'suspended'],
    default: 'pending',
  },
  is_verified: {
    type: Boolean,
    default: false,
  },
  follower_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  product_count: {
    type: Number,
    default: 0,
    min: 0,
  },
  total_sales: {
    type: Number,
    default: 0,
    min: 0,
  },
  rating_avg: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

// Indexes for performance
StoreSchema.index({ owner_email: 1 });
StoreSchema.index({ status: 1 });
StoreSchema.index({ category: 1, status: 1 });
StoreSchema.index({ follower_count: -1 });
StoreSchema.index({ rating_avg: -1 });

export const Store = mongoose.model<IStore>('Store', StoreSchema);