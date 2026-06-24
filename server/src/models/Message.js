"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Message = void 0;
const mongoose_1 = require("mongoose");
// 2. Create the Mongoose Schema defining structural enforcement for MongoDB
const MessageSchema = new mongoose_1.Schema({
    roomId: { type: String, required: true, index: true }, // Index true speeds up history queries
    userId: { type: String, required: true },
    username: { type: String, required: true },
    text: { type: String, required: true },
    replyTo: {
        messageId: { type: String },
        username: { type: String },
        text: { type: String }
    }
}, {
    timestamps: true // Automatically manages and updates 'createdAt' and 'updatedAt' fields
});
// 3. Compile the structural Schema rulebook into an executable Model constructor controller
exports.Message = (0, mongoose_1.model)('Message', MessageSchema);
//# sourceMappingURL=Message.js.map