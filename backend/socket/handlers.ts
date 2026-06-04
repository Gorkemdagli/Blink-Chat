import { Server, Socket } from 'socket.io';
import supabase from '../supabaseClient';
import redis from '../redisClient';
import logger from '../config/logger';
import { MessageController } from '../controllers/messageController';
import { env } from '../config/env';
import {
    MessageDataSchema,
    TypingSchema,
    StopTypingSchema,
    MarkReadSchema,
    InvitationSchema,
} from '../validators/socketValidators';

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

        // ─── Connection Limit (before any other processing) — atomic Lua ───
        const maxConnections = parseInt(env.SOCKET_MAX_CONNECTIONS, 10) || 20;
        const connectionKey = `connections:${userId}`;

        // Lua: INCR + check + optional rollback + EXPIRE, tek atomic işlem
        const luaScript = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local current = redis.call('INCR', key)
if current > limit then
    redis.call('DECR', key)
    return -1
end
redis.call('EXPIRE', key, 86400)
return current
`;
        const result = await redis.eval(luaScript, 1, connectionKey, maxConnections) as number;
        if (result < 0) {
            logger.warn(`Connection rejected: user ${userId} exceeded max connections (${maxConnections})`);
            socket.emit('error', `Maximum ${maxConnections} concurrent connections allowed.`);
            socket.disconnect(true);
            return;
        }

        // Bağlantı anında güvenilir username'i Redis/DB'den çek
        // Async — connection'ı block etmesin, joinRoom hemen çalışsın
        socket.data.username = 'Unknown'; // hemen ata, async resolve tamamlandığında güncellenir

        const resolveUsername = async () => {
            try {
                const cacheKey = `user:${userId}`;
                const cached = await redis.get(cacheKey);
                if (cached) {
                    socket.data.username = JSON.parse(cached).username || 'Unknown';
                } else {
                    const { data: dbUser } = await supabase
                        .from('users')
                        .select('id, username, email, user_code, avatar_url')
                        .eq('id', userId)
                        .single();
                    if (dbUser) {
                        socket.data.username = dbUser.username || 'Unknown';
                        await redis.set(cacheKey, JSON.stringify(dbUser), 'EX', 3600);
                    }
                }
            } catch (err) {
                logger.error('Failed to resolve username:', err);
            }
        }
        resolveUsername(); // fire-and-forget

        logger.info(`User connected: ${socket.id} (uid: ${userId}) | Total: ${io.engine.clientsCount}`);

        // Her kullanıcıyı kendi ID'sine özel bir odaya ekle (Cross-instance bildirimler için)
        socket.join(`user:${userId}`);

        // Redis'te online durumunu merkezi olarak tut (EX 60 ile otomatik düşme)
        redis.set(`user:status:${userId}`, 'online', 'EX', 60).catch(err => {
            logger.error(`Redis presence set error:`, err);
        });

        // Redis heartbeat + debounced DB last_seen update
        let lastSeenUpdate = 0
        socket.on('heartbeat', () => {
            redis.set(`user:status:${userId}`, 'online', 'EX', 60).catch(err => {
                logger.error(`Redis presence heartbeat error:`, err);
            })
            // V2: Debounce DB write to ~30s
            const now = Date.now()
            if (now - lastSeenUpdate > 30000) {
                lastSeenUpdate = now
                supabase.from('user_last_seen').upsert({
                    user_id: userId,
                    last_seen_at: new Date().toISOString(),
                    status: 'online'
                }).catch(err => logger.error('last_seen upsert error:', err))
            }
        })

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
        socket.on('sendMessage', async (data: unknown) => {
            const parsed = MessageDataSchema.safeParse(data);
            if (!parsed.success) {
                socket.emit('error', { event: 'sendMessage', message: 'invalid payload' });
                return;
            }

            const rateLimitKey = `ratelimit:msg:${userId}`;
            const windowMs = parseInt(env.SOCKET_RATE_LIMIT_MS, 10);

            const allowed = await (redis as any).rateLimitMsg(rateLimitKey, windowMs);
            if (!allowed) {
                socket.emit('rate_limited', { retryAfter: windowMs });
                return;
            }

            // Global per-user budget (120 msg/min across all sockets = ~2/sec)
            const globalKey = `ratelimit:msg-global:${userId}`;
            const globalAllowed = await (redis as any).rateLimitMsgGlobal(globalKey, 120, 60000);
            if (!globalAllowed) {
                socket.emit('rate_limited', { retryAfter: 60000, global: true });
                return;
            }

            // Client'in gönderdiği userId'yi yok say, token'dan gelen güvenli değeri kullan
            const safeData = { ...parsed.data, userId };
            MessageController.handleSendMessage(io, socket, safeData);
        });

        // ─── typing: userId + username override ───
        socket.on('typing', (data: unknown) => {
            const parsed = TypingSchema.safeParse(data);
            if (!parsed.success) {
                socket.emit('error', { event: 'typing', message: 'invalid payload' });
                return;
            }
            MessageController.handleTyping(socket, { ...parsed.data, userId, username: socket.data.username });
        });

        socket.on('stop_typing', (data: unknown) => {
            const parsed = StopTypingSchema.safeParse(data);
            if (!parsed.success) {
                socket.emit('error', { event: 'stop_typing', message: 'invalid payload' });
                return;
            }
            MessageController.handleStopTyping(socket, { ...parsed.data, userId });
        });

        // ─── mark_read: userId override ───
        socket.on('mark_read', (data: unknown) => {
            const parsed = MarkReadSchema.safeParse(data);
            if (!parsed.success) {
                socket.emit('error', { event: 'mark_read', message: 'invalid payload' });
                return;
            }
            MessageController.handleMarkRead(io, socket, { ...parsed.data, userId });
        });

        // ─── invitation_sent: Reali-time notification fallback ───
        socket.on('invitation_sent', async (data: unknown) => {
            const parsed = InvitationSchema.safeParse(data);
            if (!parsed.success) {
                socket.emit('error', { event: 'invitation_sent', message: 'invalid payload' });
                return;
            }

            const { roomId, inviteeId } = parsed.data;

            // Yetki kontrolü: gönderici bu odanın üyesi mi?
            try {
                const { data: membership, error } = await supabase
                    .from('room_members')
                    .select('user_id')
                    .eq('room_id', roomId)
                    .eq('user_id', userId)
                    .maybeSingle();

                if (error || !membership) {
                    logger.warn(`invitation_sent rejected: User ${userId} is not a member of room ${roomId}`);
                    socket.emit('error', { event: 'invitation_sent', message: 'Bu odaya davet gönderme yetkiniz yok.' });
                    return;
                }
            } catch (err) {
                logger.error('invitation_sent membership check error:', err);
                socket.emit('error', { event: 'invitation_sent', message: 'Yetki kontrolü başarısız.' });
                return;
            }

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
                    // V2: DB'de anlık offline göster
                    supabase.from('user_last_seen').upsert({
                        user_id: userId,
                        last_seen_at: new Date().toISOString(),
                        status: 'offline'
                    }).catch(err => logger.error('last_seen offline upsert error:', err));
                }
            } catch (err) {
                logger.error(`Redis presence del error:`, err);
            }
        });
    });
}
