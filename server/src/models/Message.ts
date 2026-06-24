import { Schema, model, Document } from 'mongoose';

// 1. Define a TypeScript Interface ensuring full code-level autocompletion typing
export interface IMessage extends Document {
  roomId: string;
  userId: string;
  username: string;
  text: string;
  replyTo?: {
    messageId: string;
    username: string;
    text: string;
  };
  createdAt: Date;
}

// 2. Create the Mongoose Schema defining structural enforcement for MongoDB
const MessageSchema = new Schema<IMessage>({
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
export const Message = model<IMessage>('Message', MessageSchema);