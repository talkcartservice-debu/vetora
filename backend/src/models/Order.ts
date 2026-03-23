import mongoose, { Document, Schema } from 'mongoose';

export interface IOrderItem {
  product_id: string;
  product_title: string;
  product_image?: string;
  quantity: number;
  price: number;
}

export interface IOrder extends Document {
  _id: mongoose.Types.ObjectId;
  buyer_email: string;
  buyer_name?: string;
  vendor_email: string;
  store_id: string;
  store_name?: string;
  items: IOrderItem[];
  subtotal: number;
  shipping_fee: number;
  total: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  shipping_address?: string;
  tracking_number?: string;
  order_note?: string;
  affiliate_email?: string;
  affiliate_commission: number;
  payment_method: 'card' | 'paypal' | 'crypto' | 'bank_transfer' | 'paystack';
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_reference?: string;
  payment_provider?: 'stripe' | 'paystack';
  created_at: Date;
  updated_at: Date;
}

const OrderItemSchema = new Schema<IOrderItem>({
  product_id: {
    type: String,
    required: true,
  },
  product_title: {
    type: String,
    required: true,
  },
  product_image: {
    type: String,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
}, { _id: false });

const OrderSchema = new Schema<IOrder>({
  buyer_email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  buyer_name: {
    type: String,
    trim: true,
  },
  vendor_email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  store_id: {
    type: String,
    required: true,
  },
  store_name: {
    type: String,
    trim: true,
  },
  items: [OrderItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0,
  },
  shipping_fee: {
    type: Number,
    default: 0,
    min: 0,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending',
  },
  shipping_address: {
    type: String,
  },
  tracking_number: {
    type: String,
  },
  order_note: {
    type: String,
    trim: true,
  },
  affiliate_email: {
    type: String,
    lowercase: true,
    trim: true,
  },
  affiliate_commission: {
    type: Number,
    default: 0,
    min: 0,
  },
  payment_method: {
    type: String,
    enum: ['card', 'paypal', 'crypto', 'bank_transfer', 'paystack'],
    default: 'paystack',
  },
  payment_status: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
  },
  payment_reference: {
    type: String,
    trim: true,
  },
  payment_provider: {
    type: String,
    enum: ['stripe', 'paystack'],
    default: 'paystack',
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

// Indexes for performance
OrderSchema.index({ buyer_email: 1, created_at: -1 });
OrderSchema.index({ vendor_email: 1, created_at: -1 });
OrderSchema.index({ store_id: 1, created_at: -1 });
OrderSchema.index({ status: 1, created_at: -1 });
OrderSchema.index({ payment_status: 1 });
OrderSchema.index({ affiliate_email: 1 });

export const Order = mongoose.model<IOrder>('Order', OrderSchema);