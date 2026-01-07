const xss = require('xss');
const supabase = require('../supabaseClient');
const redis = require('../redisClient');
const logger = require('../config/logger');

// Aktif kullanıcıları takip et
const activeUsers = new Map();

function setupSocketHandlers(io) {
    io.on('connection', (socket) => {
        logger.info(`User connected: ${socket.id} | Total: ${io.engine.clientsCount}`);

        // Kullanıcı bilgisini sakla
        activeUsers.set(socket.id, {
            connectedAt: new Date(),
            rooms: new Set()
        });

        socket.on('joinRoom', (roomId) => {
            socket.join(roomId);
            const user = activeUsers.get(socket.id);
            if (user) {
                user.rooms.add(roomId);
            }
        });

        socket.on('leaveRoom', (roomId) => {
            socket.leave(roomId);
            const user = activeUsers.get(socket.id);
            if (user) {
                user.rooms.delete(roomId);
            }
        });

        socket.on('sendMessage', async ({ roomId, userId, content, fileUrl, messageType = 'text', fileName, fileSize }) => {
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

        socket.on('typing', ({ roomId, userId, username }) => {
            socket.to(roomId).emit('typing', { userId, username, isTyping: true });
        });

        socket.on('stop_typing', ({ roomId, userId }) => {
            socket.to(roomId).emit('stop_typing', { userId, isTyping: false });
        });

        socket.on('mark_read', async ({ roomId, userId }) => {
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

        socket.on('disconnect', (reason) => {
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

module.exports = { setupSocketHandlers };
