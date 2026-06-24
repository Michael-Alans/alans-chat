"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const backend_1 = require("@clerk/backend");
const Message_1 = require("./models/Message");
dotenv_1.default.config();
const app = (0, express_1.default)();
// Wrap Express in a standard Node HTTP server container so Socket.io can intercept requests
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: '*', // Allow any local port to connect (Fixes Vite randomly picking 5174/5175 over 5173)
        methods: ['GET', 'POST']
    }
});
// Instantiate the secure Clerk backend SDK compiler instance
const clerkClient = (0, backend_1.createClerkClient)({ secretKey: process.env.CLERK_SECRET_KEY });
// In-memory registry state map tracking online room members: { roomId: { socketId: username } }
const roomUsers = {};
// --- SOCKET.IO INTERCEPTOR MIDDLEWARE ---
io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token)
        return next(new Error('Authentication error: Token payload missing'));
    try {
        // Explicitly verify the JWT Token payload outside of an HTTP Request context
        const payload = await (0, backend_1.verifyToken)(token, {
            secretKey: process.env.CLERK_SECRET_KEY
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
    }
    catch (err) {
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
        if (!roomId)
            return socket.emit('error', 'Channel identifier string required');
        // Housekeeping: If the socket is shifting channels, cleanly isolate them out of the old space
        if (currentRoom) {
            socket.leave(currentRoom);
            delete roomUsers[currentRoom]?.[socket.id];
            io.to(currentRoom).emit('room:presence', Object.values(roomUsers[currentRoom] || {}));
        }
        currentRoom = roomId;
        socket.join(roomId);
        // Initialize the presence registration object track array if it doesn't exist
        if (!roomUsers[roomId])
            roomUsers[roomId] = {};
        roomUsers[roomId][socket.id] = user.username;
        // CRUD - Read Operations: Query the database for the 50 most recent room messages
        const history = await Message_1.Message.find({ roomId }).sort({ createdAt: -1 }).limit(50);
        socket.emit('room:history', history.reverse()); // Flip chronological timeline back to top-to-bottom
        // Broadcast updated presence rosters out to everyone inside the target room
        io.to(roomId).emit('room:presence', Object.values(roomUsers[roomId]));
    });
    // Listen for Incoming Message Payloads
    socket.on('message:send', async ({ text, replyTo }) => {
        if (!currentRoom || !text.trim())
            return;
        // CRUD - Create Operations: Persist the chat payload onto disk via Mongoose
        const messageData = {
            roomId: currentRoom,
            userId: user.id,
            username: user.username,
            text: text.trim(),
        };
        if (replyTo) {
            messageData.replyTo = replyTo;
        }
        const newMessage = await Message_1.Message.create(messageData);
        // Send the message back out to all clients currently connected to this specific room channel
        io.to(currentRoom).emit('message:received', newMessage);
    });
    // Handle Editing an Existing Message
    socket.on('message:update', async ({ id, text }) => {
        if (!currentRoom || !text.trim())
            return;
        // CRUD - Update: Find the message, ensure the user owns it, then update the text
        const updatedMessage = await Message_1.Message.findOneAndUpdate({ _id: id, userId: user.id }, // Security constraint: Must own to strictly modify
        { text: text.trim() }, { new: true } // Returns the modified object natively
        );
        if (updatedMessage) {
            io.to(currentRoom).emit('message:updated', updatedMessage);
        }
    });
    // Handle Deleting an Existing Message
    socket.on('message:delete', async ({ id }) => {
        if (!currentRoom)
            return;
        // CRUD - Delete: Find the message, ensure the user owns it, then delete
        const deletedMessage = await Message_1.Message.findOneAndDelete({ _id: id, userId: user.id });
        if (deletedMessage) {
            io.to(currentRoom).emit('message:deleted', { id });
        }
    });
    // Relay Live Fluid Typing States
    socket.on('typing:start', () => {
        if (currentRoom)
            socket.to(currentRoom).emit('typing:status', { username: user.username, isTyping: true });
    });
    socket.on('typing:stop', () => {
        if (currentRoom)
            socket.to(currentRoom).emit('typing:status', { username: user.username, isTyping: false });
    });
    // Clean up when a connection cuts out
    socket.on('disconnect', () => {
        if (currentRoom && roomUsers[currentRoom]) {
            delete roomUsers[currentRoom][socket.id];
            io.to(currentRoom).emit('room:presence', Object.values(roomUsers[currentRoom] || {}));
        }
    });
});
// Spin up connections
mongoose_1.default.connect(process.env.MONGODB_URI)
    .then(() => {
    httpServer.listen(process.env.PORT || 5000, () => console.log('⚡ Server Engine Bound to Pipeline'));
})
    .catch(err => console.error('Database instantiation breakdown:', err));
//# sourceMappingURL=index.js.map