import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is not defined. Fix your .env file.");
}

const redactMongoUri = (uri) => {
  try {
    const parsed = new URL(uri);
    // Preserve scheme/host/db, strip credentials + query
    const dbPath = parsed.pathname || "";
    return `${parsed.protocol}//${parsed.host}${dbPath}`;
  } catch {
    // Fallback: strip credentials in the common scheme://user:pass@host form
    return String(uri).replace(/:\/\/.*@/, "://***@");
  }
};

console.log("MONGO URI USED:", redactMongoUri(MONGODB_URI));



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
  
  // If connecting, wait for it with timeout
  if (mongoose.connection.readyState === 2) {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Database connection timeout after 15 seconds'));
      }, 15000);
      
      mongoose.connection.once('connected', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      mongoose.connection.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
    return;
  }
  
  // Otherwise, connect with timeout
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Database connection timeout after 20 seconds'));
      }, 20000);

      connectDB()
        .then((result) => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timeout);
          reject(err);
        });
    });
    
    if (mongoose.connection.readyState !== 1) {
      throw new Error("Database not connected after connection attempt");
    }
  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  }
};

export default connectDB;

