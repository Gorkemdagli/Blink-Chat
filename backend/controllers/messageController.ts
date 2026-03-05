import { Server, Socket } from 'socket.io';
import { MessageService, MessageData } from '../services/messageService';
import logger from '../config/logger';
import { MessageDataSchema, MarkReadSchema, TypingSchema, StopTypingSchema } from '../validators/socketValidators';
import { z } from 'zod';

// Inferred types from Zod schemas — single source of truth
type MessageInput = z.infer<typeof MessageDataSchema>;
type MarkReadInput = z.infer<typeof MarkReadSchema>;
type TypingInput = z.infer<typeof TypingSchema>;
type StopTypingInput = z.infer<typeof StopTypingSchema>;

export class MessageController {
    /**
     * Receives raw socket payload (unknown), normalises fileSize, validates
     * against MessageDataSchema, then persists and broadcasts to the room.
     */
    static async handleSendMessage(io: Server, socket: Socket, data: unknown) {
        try {
            // Normalise fileSize before schema parse:
            // socket clients may send null, undefined, or a numeric string
            const raw = data && typeof data === 'object' ? data as Record<string, unknown> : {};
            const normalised = {
                ...raw,
                fileSize: raw.fileSize === null || raw.fileSize === undefined
                    ? null
                    : Number(raw.fileSize),
            };

            const validatedData: MessageInput = MessageDataSchema.parse(normalised);
            const messageWithUser = await MessageService.saveMessage(validatedData as MessageData);

            io.to(validatedData.roomId).emit('newMessage', messageWithUser);
        } catch (error) {
            if (error instanceof z.ZodError) {
                logger.warn(`Validation error on sendMessage: ${error.message}`);
                socket.emit('error', 'Geçersiz mesaj verisi: ' + error.issues[0].message);
            } else {
                logger.error('Error saving message:', error);
                socket.emit('error', 'Mesaj gönderilemedi.');
            }
        }
    }

    static async handleMarkRead(io: Server, socket: Socket, data: unknown) {
        try {
            const validatedData: MarkReadInput = MarkReadSchema.parse(data);
            logger.debug(`mark_read event: room=${validatedData.roomId}, user=${validatedData.userId}`);
            await MessageService.markMessagesAsRead(validatedData.roomId, validatedData.userId);

            io.to(validatedData.roomId).emit('messages_read', {
                roomId: validatedData.roomId,
                userId: validatedData.userId,
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                logger.warn(`Validation error on mark_read: ${error.message}`);
            }
            // Non-validation errors already logged in service
        }
    }

    static handleTyping(socket: Socket, data: unknown) {
        try {
            const validatedData: TypingInput = TypingSchema.parse(data);
            socket.to(validatedData.roomId).emit('typing', {
                userId: validatedData.userId,
                username: validatedData.username,
                isTyping: true,
            });
        } catch (error) {
            logger.debug('typing validation error:', error);
        }
    }

    static handleStopTyping(socket: Socket, data: unknown) {
        try {
            const validatedData: StopTypingInput = StopTypingSchema.parse(data);
            socket.to(validatedData.roomId).emit('stop_typing', {
                userId: validatedData.userId,
                isTyping: false,
            });
        } catch (error) {
            logger.debug('stop_typing validation error:', error);
        }
    }
}
