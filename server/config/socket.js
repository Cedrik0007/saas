import { Server } from "socket.io";

let io = null;

export const initializeSocket = (server) => {
  // Allow multiple origins for production
  const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? [
        "https://subs-manager.vercel.app",
        "https://saas-cj3b.onrender.com",
        "https://admin.imahk.org",
        process.env.FRONTEND_URL || "*"
      ]
    : ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"];

  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling'], // Allow both transports
    allowEIO3: true // Support older Socket.io clients
  });

  io.on('connection', (socket) => {
    console.log('✓ Client connected:', socket.id);

    socket.on('disconnect', () => {
      console.log('✗ Client disconnected:', socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initializeSocket first.');
  }
  return io;
};

// Helper functions to emit events
export const emitMemberUpdate = (event, data) => {
  if (io) {
    io.emit(`member:${event}`, data);
  }
};

export const emitInvoiceUpdate = (event, data) => {
  if (io) {
    io.emit(`invoice:${event}`, data);
  }
};

export const emitPaymentUpdate = (event, data) => {
  if (io) {
    io.emit(`payment:${event}`, data);
  }
};

export const emitDonationUpdate = (event, data) => {
  if (io) {
    io.emit(`donation:${event}`, data);
  }
};

