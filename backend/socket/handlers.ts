import { Server, Socket } from 'socket.io';
import logger from '../config/logger';
import { MessageController } from '../controllers/messageController';

interface User {
    connectedAt: Date;
    rooms: Set<string>;
}

// Aktif kullanıcıları takip et
const activeUsers = new Map<string, User>();

export function setupSocketHandlers(io: Server) {
    io.on('connection', (socket: Socket) => {
        logger.info(`User connected: ${socket.id} | Total: ${io.engine.clientsCount}`);

        // Kullanıcı bilgisini sakla
        activeUsers.set(socket.id, {
            connectedAt: new Date(),
            rooms: new Set()
        });

        socket.on('joinRoom', (roomId: string) => {
            socket.join(roomId);
            const user = activeUsers.get(socket.id);
            if (user) {
                user.rooms.add(roomId);
            }
        });

        socket.on('leaveRoom', (roomId: string) => {
            socket.leave(roomId);
            const user = activeUsers.get(socket.id);
            if (user) {
                user.rooms.delete(roomId);
            }
        });

        socket.on('sendMessage', (data) => MessageController.handleSendMessage(io, socket, data));
        socket.on('typing', (data) => MessageController.handleTyping(socket, data));
        socket.on('stop_typing', (data) => MessageController.handleStopTyping(socket, data));
        socket.on('mark_read', (data) => MessageController.handleMarkRead(io, socket, data));

        socket.on('disconnect', (reason: string) => {
            const user = activeUsers.get(socket.id);
            if (user) {
                logger.info(`User disconnected: ${socket.id} | Reason: ${reason} | Total: ${io.engine.clientsCount}`);
                logger.debug(`User was in rooms: ${Array.from(user.rooms).join(', ')}`);
                activeUsers.delete(socket.id);
            } else {
                logger.info(`User disconnected: ${socket.id} | Reason: ${reason}`);
            }
        });
    });
}
