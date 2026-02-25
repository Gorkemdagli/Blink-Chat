import { Server, Socket } from 'socket.io';
import xss from 'xss';
import supabase from '../supabaseClient';
import redis from '../redisClient';
import logger from '../config/logger';

interface User {
    connectedAt: Date;
    rooms: Set<string>;
}

interface MessageData {
    roomId: string;
    userId: string;
    content: string;
    fileUrl?: string;
    messageType?: string;
    fileName?: string;
    fileSize?: number;
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

        socket.on('sendMessage', async ({ roomId, userId, content, fileUrl, messageType = 'text', fileName, fileSize }: MessageData) => {
            // Sanitize content to prevent XSS
            const sanitizedContent = xss(content);

            // Save to Supabase
            const { data, error } = await supabase
                .from('messages')
                .insert([{
                    room_id: roomId,
                    user_id: userId,
                    content: sanitizedContent,
                    file_url: fileUrl || null,
                    message_type: messageType,
                    file_name: fileName || null,
                    file_size: fileSize || null,
                    status: 'sent'
                }])
                .select();

            if (error) {
                logger.error('Error saving message:', error);
                socket.emit('error', 'Message could not be sent');
                return;
            }

            // Kullanıcı bilgisini de gönder
            // Kullanıcıyı Cache'den veya DB'den al
            let user;
            const cacheKey = `user:${userId}`;
            const cachedUser = await redis.get(cacheKey);

            if (cachedUser) {
                logger.debug(`Redis cache hit for user: ${userId}`);
                user = JSON.parse(cachedUser);
            } else {
                logger.debug(`Redis cache miss, fetching from DB: ${userId}`);
                const { data: dbUser, error: userError } = await supabase
                    .from('users')
                    .select('id, username, email, user_code, avatar_url')
                    .eq('id', userId)
                    .single();

                if (userError) {
                    logger.error('Error fetching user:', userError);
                    // Fallback or handle error? For now, continue but user might be null
                } else {
                    user = dbUser;
                    // Cache for 1 hour
                    await redis.set(cacheKey, JSON.stringify(user), 'EX', 3600);
                }
            }

            const messageWithUser = {
                ...data[0],
                user: user
            };

            // Room'daki herkese broadcast et
            io.to(roomId).emit('newMessage', messageWithUser);

            // TÜM bağlı kullanıcılara global broadcast (unread badge için)
            io.emit('globalNewMessage', messageWithUser);
        });

        socket.on('typing', ({ roomId, userId, username }: { roomId: string, userId: string, username: string }) => {
            socket.to(roomId).emit('typing', { userId, username, isTyping: true });
        });

        socket.on('stop_typing', ({ roomId, userId }: { roomId: string, userId: string }) => {
            socket.to(roomId).emit('stop_typing', { userId, isTyping: false });
        });

        socket.on('mark_read', async ({ roomId, userId }: { roomId: string, userId: string }) => {
            logger.debug(`mark_read event: room=${roomId}, user=${userId}`);
            // Update messages in DB
            const { data, error, count } = await supabase
                .from('messages')
                .update({ status: 'read' })
                .eq('room_id', roomId)
                .neq('user_id', userId) // Don't mark own messages as read by self
                .not('status', 'eq', 'read') // Update all messages that are NOT 'read'
                .select();

            if (error) {
                logger.error('Error marking messages as read:', error);
            } else {
                logger.debug(`Marked ${data?.length || 0} messages as read in room ${roomId}`);
            }

            // Notify room (msg sender will see blue ticks)
            io.to(roomId).emit('messages_read', { roomId, userId });
        });

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
