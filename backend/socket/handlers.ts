import { Server, Socket } from 'socket.io';
import supabase from '../supabaseClient';
import redis from '../redisClient';
import logger from '../config/logger';
import { MessageController } from '../controllers/messageController';
import { env } from '../config/env';

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

        // ─── Connection Limit (before any other processing) ───
        const maxConnections = parseInt(env.SOCKET_MAX_CONNECTIONS, 10);
        const connectionKey = `connections:${userId}`;

        const currentCount = await redis.incr(connectionKey);
        if (currentCount > maxConnections) {
            await redis.decr(connectionKey); // rollback the incr
            logger.warn(`Connection rejected: user ${userId} exceeded max connections (${maxConnections})`);
            socket.emit('error', `Maximum ${maxConnections} concurrent connections allowed.`);
            socket.disconnect(true);
            return;
        }
        // Safety: set 24h expiry so orphaned keys eventually clear
        await redis.expire(connectionKey, 86400);

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

        // Her kullanıcıyı kendi ID'sine özel bir odaya ekle (Cross-instance bildirimler için)
        socket.join(`user:${userId}`);

        // Redis'te online durumunu merkezi olarak tut (EX 60 ile otomatik düşme)
        redis.set(`user:status:${userId}`, 'online', 'EX', 60).catch(err => {
            logger.error(`Redis presence set error:`, err);
        });

        // İstemci heartbeat gönderdikçe süreyi uzatması için
        socket.on('heartbeat', () => {
            redis.set(`user:status:${userId}`, 'online', 'EX', 60).catch(err => {
                logger.error(`Redis presence heartbeat error:`, err);
            });
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
            } catch (err) {
                logger.error('joinRoom error:', err);
            }
        });

        socket.on('leaveRoom', (roomId: string) => {
            socket.leave(roomId);
        });

        // ─── sendMessage: Rate limit + userId override ───
        socket.on('sendMessage', async (data: any) => {
            const rateLimitKey = `ratelimit:msg:${socket.id}`;
            const windowMs = parseInt(env.SOCKET_RATE_LIMIT_MS, 10);

            const allowed = await (redis as any).rateLimitMsg(rateLimitKey, windowMs);
            if (!allowed) {
                socket.emit('rate_limited', { retryAfter: windowMs });
                return;
            }

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

        // ─── invitation_sent: Reali-time notification fallback ───
        socket.on('invitation_sent', ({ inviteeId }: { inviteeId: string }) => {
            if (!inviteeId) return;
            // Redis Adapter ile tüm sunuculardaki hedefe iletilir
            io.to(`user:${inviteeId}`).emit('new_invitation');
        });

        socket.on('disconnect', async (reason: string) => {
            logger.info(`User disconnected: ${socket.id} (uid: ${userId}) | Reason: ${reason} | Total: ${io.engine.clientsCount}`);

            try {
                await (redis as any).decrementConnections(connectionKey);
            } catch (err) {
                logger.error('decrementConnections error:', err);
            }

            try {
                // Adapter üzerinden tüm sunuculardaki user odasını kontrol et
                const sockets = await io.in(`user:${userId}`).fetchSockets();
                if (sockets.length === 0) {
                    // Kullanıcının hiçbir sekmesi/bağlantısı kalmadıysa offline yap
                    await redis.del(`user:status:${userId}`);
                }
            } catch (err) {
                logger.error(`Redis presence del error:`, err);
            }
        });
    });
}
