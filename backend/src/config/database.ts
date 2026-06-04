import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/iqon';

export const connectDB = async () => {
  try {
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      maxPoolSize: 20,
      minPoolSize: 5,
      socketTimeoutMS: 45000,
    } as any);
    console.log('✅ Connected to MongoDB');

    // Simplified index cleanup - run only on startup, async
    setTimeout(async () => {
      try {
        const db = mongoose.connection.db;
        if (db) {
          const usersCollection = db.collection('users');
          const indexes = await usersCollection.indexes();
          const hasUsernameIndex = indexes.some(idx => idx.name === 'username_1');
          if (hasUsernameIndex) {
            console.log('⚠️  Found stale username_1 index, dropping...');
            await usersCollection.dropIndex('username_1').catch(() => {});
          }
        }
      } catch (e) {
        // Silent fail - indexes are not critical
      }
    }, 1000);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
  }
};

// Handle connection events
mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected');
});

mongoose.connection.on('error', (error) => {
  console.error('❌ MongoDB connection error:', error);
});

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('🔄 MongoDB connection closed');
  process.exit(0);
});