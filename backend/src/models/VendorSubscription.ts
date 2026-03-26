import mongoose, { Schema, Document } from 'mongoose';

export interface IVendorSubscription extends Document {
  vendor_email: string;
  store_id?: string;
  plan: 'free' | 'pro' | 'elite';
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  billing_cycle: 'monthly' | 'annual';
  started_at: Date;
  expires_at?: Date;
  custom_domain?: string;
  payment_method?: string;
  payment_reference?: string;
  last_payment_date?: Date;
  created_at: Date;
  updated_at: Date;
}

const VendorSubscriptionSchema = new Schema<IVendorSubscription>({
  vendor_email: {
    type: String,
    required: true,
    index: true
  },
  store_id: {
    type: String,
    index: true
  },
  plan: {
    type: String,
    enum: ['free', 'pro', 'elite'],
    default: 'free',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'expired', 'pending'],
    default: 'active'
  },
  billing_cycle: {
    type: String,
    enum: ['monthly', 'annual'],
    default: 'monthly'
  },
  started_at: {
    type: Date,
    default: Date.now
  },
  expires_at: {
    type: Date
  },
  custom_domain: {
    type: String,
    sparse: true,
    unique: true
  },
  payment_method: {
    type: String
  },
  payment_reference: {
    type: String,
    sparse: true,
    unique: true
  },
  last_payment_date: {
    type: Date
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound indexes for efficient queries
VendorSubscriptionSchema.index({ store_id: 1, status: 1 });
VendorSubscriptionSchema.index({ status: 1, expires_at: 1 });

// Ensure one active subscription per vendor/store
VendorSubscriptionSchema.index(
  { vendor_email: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' }
  }
);

export const VendorSubscription = mongoose.model<IVendorSubscription>('VendorSubscription', VendorSubscriptionSchema);