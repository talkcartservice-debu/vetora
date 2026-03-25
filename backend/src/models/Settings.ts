import mongoose, { Document, Schema } from 'mongoose';

export interface ISettings extends Document {
  maintenance_mode: boolean;
  maintenance_message?: string;
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
}, {
  timestamps: {
    createdAt: false,
    updatedAt: 'updated_at',
  },
});

export const Settings = mongoose.model<ISettings>('Settings', SettingsSchema);