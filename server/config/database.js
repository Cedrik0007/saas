import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://0741sanjai_db_user:L11x9pdm3tHuOJE9@members.mmnf0pe.mongodb.net/subscriptionmanager";

// Optimized connection options for better performance
const mongooseOptions = {
  serverSelectionTimeoutMS: 30000, // Increased timeout for better reliability
  socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
  connectTimeoutMS: 15000, // Increased connection timeout
  maxPoolSize: 10, // Increased pool size for better concurrency
  minPoolSize: 2, // Maintain minimum connections
  maxIdleTimeMS: 30000, // Close idle connections after 30s
  retryWrites: true, // Enable retry for write operations
  retryReads: true, // Enable retry for read operations
};

// Disable mongoose buffering globally (do this before connect)
mongoose.set('bufferCommands', false);

// Cache the connection to avoid multiple connections in serverless
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      ...mongooseOptions,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log("✓ MongoDB connected successfully");
      
      // Set up connection event listeners for better monitoring
      mongoose.connection.on('connected', () => {
        console.log('✓ Mongoose connected to MongoDB');
      });
      
      mongoose.connection.on('error', (err) => {
        console.error('✗ Mongoose connection error:', err);
      });
      
      mongoose.connection.on('disconnected', () => {
        console.warn('⚠ Mongoose disconnected from MongoDB');
      });
      
      return mongoose;
    }).catch((err) => {
      console.error("✗ MongoDB connection error:", err);
      cached.promise = null;
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

// Optimized helper function to ensure DB connection before operations
export const ensureConnection = async () => {
  // If already connected, return immediately
  if (mongoose.connection.readyState === 1) {
    return;
  }
  
  // If connecting, wait for it
  if (mongoose.connection.readyState === 2) {
    await new Promise((resolve, reject) => {
      mongoose.connection.once('connected', resolve);
      mongoose.connection.once('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });
    return;
  }
  
  // Otherwise, connect
  await connectDB();
  if (mongoose.connection.readyState !== 1) {
    throw new Error("Database not connected");
  }
};

export default connectDB;

