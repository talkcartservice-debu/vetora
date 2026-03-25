import mongoose, { Schema, Document } from 'mongoose';

export interface IWithdrawal extends Document {
  vendor_email: string;
  store_id?: string;
  store_name?: string;
  amount: number;
  payment_method: 'bank_transfer' | 'paypal';
  bank_account_name?: string;
  bank_account_number?: string;
  bank_name?: string;
  routing_number?: string;
  paypal_email?: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  notes?: string;
  processed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const WithdrawalSchema = new Schema<IWithdrawal>({
  vendor_email: {
    type: String,
    required: true,
    index: true
  },
  store_id: {
    type: String,
    index: true
  },
  store_name: {
    type: String
  },
  amount: {
    type: Number,
    required: true,
    min: 20
  },
  payment_method: {
    type: String,
    enum: ['bank_transfer', 'paypal'],
    default: 'bank_transfer',
    required: true
  },
  bank_account_name: {
    type: String,
  },
  bank_account_number: {
    type: String,
  },
  bank_name: {
    type: String,
  },
  routing_number: {
    type: String
  },
  paypal_email: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'rejected'],
    default: 'pending'
  },
  notes: {
    type: String
  },
  processed_at: {
    type: Date
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound indexes for efficient queries
WithdrawalSchema.index({ vendor_email: 1, status: 1 });
WithdrawalSchema.index({ vendor_email: 1, created_at: -1 });
WithdrawalSchema.index({ status: 1, created_at: -1 });
WithdrawalSchema.index({ store_id: 1, status: 1 });

export const Withdrawal = mongoose.model<IWithdrawal>('Withdrawal', WithdrawalSchema);