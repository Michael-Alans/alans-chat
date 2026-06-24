import { Document } from 'mongoose';
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
export declare const Message: import("mongoose").Model<IMessage, {}, {}, {}, Document<unknown, {}, IMessage, {}, import("mongoose").DefaultSchemaOptions> & IMessage & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IMessage>;
//# sourceMappingURL=Message.d.ts.map