import { Server, Socket } from 'socket.io';
import supabase from '../supabaseClient';
import redis from '../redisClient';
import logger from '../config/logger';
import { MessageController } from '../controllers/messageController';

interface AuthenticatedUser {
    id: string;
    email?: string;
    connectedAt: Date;
    rooms: Set<string>;
}

// Aktif kullanıcıları takip et
const activeUsers = new Map<string, AuthenticatedUser>();

// Socket rate limiter (mesaj başına 500ms cooldown)
const lastMessageTime = new Map<string, number>();
const MESSAGE_COOLDOWN_MS = 500;

export function setupSocketHandlers(io: Server) {
    // ─── JWT Authentication Middleware ───
    io.use(async (socket, next) => {
        const token = socket.handshake.auth?.token;

        if (!token) {
            logger.warn(`Socket auth rejected: No token provided (${socket.id})`);
            return next(new Error('Authentication required'));
        }

        try {
            const { data: { user }, error } = await supabase.auth.getUser(token);

            if (error || !user) {
                logger.warn(`Socket auth rejected: Invalid token (${socket.id})`);
                return next(new Error('Invalid or expired token'));
            }

            // Token geçerli — kullanıcı bilgisini socket'e bağla
            socket.data.userId = user.id;
            socket.data.email = user.email;
            next();
        } catch (err) {
            logger.error('Socket auth error:', err);
            return next(new Error('Authentication failed'));
        }
    });

    io.on('connection', async (socket: Socket) => {
        const userId = socket.data.userId;

        // Bağlantı anında güvenilir username'i Redis/DB'den çek
        let username = 'Unknown';
        try {
            const cacheKey = `user:${userId}`;
            const cached = await redis.get(cacheKey);
            if (cached) {
                username = JSON.parse(cached).username || 'Unknown';
            } else {
                const { data: dbUser } = await supabase
                    .from('users')
                    .select('id, username, email, user_code, avatar_url')
                    .eq('id', userId)
                    .single();
                if (dbUser) {
                    username = dbUser.username || 'Unknown';
                    await redis.set(cacheKey, JSON.stringify(dbUser), 'EX', 3600);
                }
            }
        } catch (err) {
            logger.error('Failed to resolve username:', err);
        }
        socket.data.username = username;

        logger.info(`User connected: ${socket.id} (uid: ${userId}, name: ${username}) | Total: ${io.engine.clientsCount}`);

        activeUsers.set(socket.id, {
            id: userId,
            email: socket.data.email,
            connectedAt: new Date(),
            rooms: new Set()
        });

        // ─── joinRoom: Üyelik kontrolü ───
        socket.on('joinRoom', async (roomId: string) => {
            if (!roomId || typeof roomId !== 'string') return;

            try {
                const { data, error } = await supabase
                    .from('room_members')
                    .select('user_id')
                    .eq('room_id', roomId)
                    .eq('user_id', userId)
                    .maybeSingle();

                if (error || !data) {
                    logger.warn(`joinRoom rejected: User ${userId} is not a member of room ${roomId}`);
                    socket.emit('error', 'Bu odaya erişiminiz yok.');
                    return;
                }

                socket.join(roomId);
                const user = activeUsers.get(socket.id);
                if (user) user.rooms.add(roomId);
            } catch (err) {
                logger.error('joinRoom error:', err);
            }
        });

        socket.on('leaveRoom', (roomId: string) => {
            socket.leave(roomId);
            const user = activeUsers.get(socket.id);
            if (user) user.rooms.delete(roomId);
        });

        // ─── sendMessage: Rate limit + userId override ───
        socket.on('sendMessage', (data: any) => {
            const now = Date.now();
            const last = lastMessageTime.get(socket.id) || 0;

            if (now - last < MESSAGE_COOLDOWN_MS) {
                socket.emit('error', 'Çok hızlı mesaj gönderiyorsunuz.');
                return;
            }
            lastMessageTime.set(socket.id, now);

            // Client'in gönderdiği userId'yi yok say, token'dan gelen güvenli değeri kullan
            const safeData = { ...data, userId };
            MessageController.handleSendMessage(io, socket, safeData);
        });

        // ─── typing: userId + username override ───
        socket.on('typing', (data: any) => {
            MessageController.handleTyping(socket, { ...data, userId, username: socket.data.username });
        });

        socket.on('stop_typing', (data: any) => {
            MessageController.handleStopTyping(socket, { ...data, userId });
        });

        // ─── mark_read: userId override ───
        socket.on('mark_read', (data: any) => {
            MessageController.handleMarkRead(io, socket, { ...data, userId });
        });

        socket.on('disconnect', (reason: string) => {
            const user = activeUsers.get(socket.id);
            if (user) {
                logger.info(`User disconnected: ${socket.id} (uid: ${userId}) | Reason: ${reason} | Total: ${io.engine.clientsCount}`);
                activeUsers.delete(socket.id);
            }
            lastMessageTime.delete(socket.id);
        });
    });
}
