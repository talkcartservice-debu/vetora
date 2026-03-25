import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from './models/User';
import { connectDB } from './config/database';

async function seedAdmin() {
  try {
    await connectDB();
    console.log('Connected to database...');

    const email = 'iamthefirst2001@gmail.com';
    const password = 'Iam@12345';
    const role = 'super_admin';

    let user = await User.findOne({ email });

    if (user) {
      console.log('User already exists, updating to super_admin...');
      user.role = 'super_admin';
      user.is_blocked = false;
      user.password = await bcrypt.hash(password, 12);
      await user.save();
      console.log('Admin user updated successfully.');
    } else {
      console.log('Creating new super_admin user...');
      const hashedPassword = await bcrypt.hash(password, 12);
      user = new User({
        email,
        password: hashedPassword,
        display_name: 'Super Admin',
        role,
        is_verified: true,
        is_blocked: false,
      });
      await user.save();
      console.log('Admin user created successfully.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
}

seedAdmin();