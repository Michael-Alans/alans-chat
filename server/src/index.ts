import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { Message } from './models/Message';

dotenv.config();

const app = express();
// Wrap Express in a standard Node HTTP server container so Socket.io can intercept requests
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { 
    origin: '*', // Allow any local port to connect (Fixes Vite randomly picking 5174/5175 over 5173)
    methods: ['GET', 'POST'] 
  }
});

// Instantiate the secure Clerk backend SDK compiler instance
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY as string });

// In-memory registry state map tracking online room members: { roomId: { socketId: username } }
const roomUsers: Record<string, Record<string, string>> = {};

// --- SOCKET.IO INTERCEPTOR MIDDLEWARE ---
io.use(async (socket: Socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error: Token payload missing'));

  try {
    // Explicitly verify the JWT Token payload outside of an HTTP Request context
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY as string
    });
    
    if (!payload || !payload.sub) {
      console.log('Socket rejection: Signature verification failed or missing');
      return next(new Error('Authentication error: Session is invalid'));
    }
    
    // Fetch user details from Clerk using the verified subject ID parameter
    const user = await clerkClient.users.getUser(payload.sub);
    
    // Cache identity metrics onto the live active connection object block instance
    socket.data.user = { id: user.id, username: user.username || user.firstName || 'Anonymous' };
    console.log(`[Connection] Authorized: ${socket.data.user.username}`);
    next();
  } catch (err) {
    console.error('Socket Authentication crash:', err);
    next(new Error('Authentication error: Verification routine exception'));
  }
});

// --- CORE REAL-TIME PIPELINES ---
io.on('connection', (socket) => {
  const user = socket.data.user;
  let currentRoom = '';

  // Listen for Room Join Commands
  socket.on('room:join', async ({ roomId }) => {
    if (!roomId) return socket.emit('error', 'Channel identifier string required');

    // Housekeeping: If the socket is shifting channels, cleanly isolate them out of the old space
    if (currentRoom) {
      socket.leave(currentRoom);
      delete roomUsers[currentRoom]?.[socket.id];
      io.to(currentRoom).emit('room:presence', Object.values(roomUsers[currentRoom] || {}));
    }

    currentRoom = roomId;
    socket.join(roomId);

    // Initialize the presence registration object track array if it doesn't exist
    if (!roomUsers[roomId]) roomUsers[roomId] = {};
    roomUsers[roomId][socket.id] = user.username;

    // CRUD - Read Operations: Query the database for the 50 most recent room messages
    const history = await Message.find({ roomId }).sort({ createdAt: -1 }).limit(50);
    socket.emit('room:history', history.reverse()); // Flip chronological timeline back to top-to-bottom

    // Broadcast updated presence rosters out to everyone inside the target room
    io.to(roomId).emit('room:presence', Object.values(roomUsers[roomId]));
  });

  // Listen for Incoming Message Payloads
  socket.on('message:send', async ({ text, replyTo }) => {
    if (!currentRoom || !text.trim()) return;

    // CRUD - Create Operations: Persist the chat payload onto disk via Mongoose
    const messageData: Partial<typeof Message.schema.obj> = {
      roomId: currentRoom,
      userId: user.id,
      username: user.username,
      text: text.trim(),
    };

    if (replyTo) {
      messageData.replyTo = replyTo;
    }

    const newMessage = await Message.create(messageData);

    // Send the message back out to all clients currently connected to this specific room channel
    io.to(currentRoom).emit('message:received', newMessage);
  });

  // Handle Editing an Existing Message
  socket.on('message:update', async ({ id, text }) => {
    if (!currentRoom || !text.trim()) return;

    // CRUD - Update: Find the message, ensure the user owns it, then update the text
    const updatedMessage = await Message.findOneAndUpdate(
      { _id: id, userId: user.id }, // Security constraint: Must own to strictly modify
      { text: text.trim() },
      { new: true } // Returns the modified object natively
    );

    if (updatedMessage) {
      io.to(currentRoom).emit('message:updated', updatedMessage);
    }
  });

  // Handle Deleting an Existing Message
  socket.on('message:delete', async ({ id }) => {
    if (!currentRoom) return;

    // CRUD - Delete: Find the message, ensure the user owns it, then delete
    const deletedMessage = await Message.findOneAndDelete({ _id: id, userId: user.id });

    if (deletedMessage) {
      io.to(currentRoom).emit('message:deleted', { id });
    }
  });

  // Relay Live Fluid Typing States
  socket.on('typing:start', () => {
    if (currentRoom) socket.to(currentRoom).emit('typing:status', { username: user.username, isTyping: true });
  });

  socket.on('typing:stop', () => {
    if (currentRoom) socket.to(currentRoom).emit('typing:status', { username: user.username, isTyping: false });
  });

  // Clean up when a connection cuts out
  socket.on('disconnect', () => {
    if (currentRoom && roomUsers[currentRoom]) {
      delete roomUsers[currentRoom]![socket.id];
      io.to(currentRoom).emit('room:presence', Object.values(roomUsers[currentRoom] || {}));
    }
  });
});

// Spin up connections
mongoose.connect(process.env.MONGODB_URI!)
  .then(() => {
    httpServer.listen(process.env.PORT || 5000, () => console.log('⚡ Server Engine Bound to Pipeline'));
  })
  .catch(err => console.error('Database instantiation breakdown:', err));