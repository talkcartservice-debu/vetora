import mongoose, { Document, Schema } from 'mongoose';

export interface ISettings extends Document {
  maintenance_mode: boolean;
  maintenance_message?: string;
  allow_registration: boolean;
  min_withdrawal_amount: number;
  platform_fee_percent: number;
  updated_at: Date;
}

const SettingsSchema = new Schema<ISettings>({
  maintenance_mode: {
    type: Boolean,
    default: false,
  },
  maintenance_message: {
    type: String,
    default: 'Vetora is currently under maintenance. Please check back later.',
  },
  allow_registration: {
    type: Boolean,
    default: true,
  },
  min_withdrawal_amount: {
    type: Number,
    default: 10,
  },
  platform_fee_percent: {
    type: Number,
    default: 5,
  },
}, {
  timestamps: {
    createdAt: false,
    updatedAt: 'updated_at',
  },
});

export const Settings = mongoose.model<ISettings>('Settings', SettingsSchema);