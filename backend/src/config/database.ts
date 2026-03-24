import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vetora';

export const connectDB = async () => {
  try {
    console.log(`📡 Connecting to MongoDB at ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });
    console.log('✅ Connected to MongoDB');

    // Attempt to drop stale username index if it exists
    try {
      const db = mongoose.connection.db;
      if (db) {
        const collections = await db.listCollections({ name: 'users' }).toArray();
        if (collections.length > 0) {
          const usersCollection = db.collection('users');
          const indexes = await usersCollection.indexes();
          const hasUsernameIndex = indexes.some(idx => idx.name === 'username_1');
          
          if (hasUsernameIndex) {
            console.log('⚠️  Found stale username_1 index, dropping...');
            await usersCollection.dropIndex('username_1');
            console.log('✅ Successfully dropped username_1 index');
          }
        }
      }
    } catch (indexError) {
      console.warn('⚠️  Could not drop username_1 index (it might not exist):', indexError);
    }
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    // Do not exit, allow server to stay alive even if DB is down
    // This prevents 500 errors from the proxy when target is down
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