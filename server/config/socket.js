import { Server } from "socket.io";

let io = null;

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        "https://admin.imahk.org",
        "http://localhost:5173"
      ],
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

