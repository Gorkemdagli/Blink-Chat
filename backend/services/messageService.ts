import xss from 'xss';
import supabase from '../supabaseClient';
import redis from '../redisClient';
import logger from '../config/logger';

export interface MessageData {
    roomId: string;
    userId: string;
    content: string;
    fileUrl?: string;
    messageType?: string;
    fileName?: string;
    fileSize?: number;
}

export class MessageService {
    static async saveMessage(data: MessageData) {
        const { roomId, userId, content, fileUrl, messageType = 'text', fileName, fileSize } = data;
        const sanitizedContent = xss(content);

        const { data: messageData, error } = await supabase
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
            throw new Error('Message could not be sent');
        }

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
            } else {
                user = dbUser;
                await redis.set(cacheKey, JSON.stringify(user), 'EX', 3600);
            }
        }

        return {
            ...messageData[0],
            user: user
        };
    }

    static async markMessagesAsRead(roomId: string, userId: string) {
        const { data, error } = await supabase
            .from('messages')
            .update({ status: 'read' })
            .eq('room_id', roomId)
            .neq('user_id', userId)
            .not('status', 'eq', 'read')
            .select();

        if (error) {
            logger.error('Error marking messages as read:', error);
            throw error;
        }

        logger.debug(`Marked ${data?.length || 0} messages as read in room ${roomId}`);
        return data;
    }
}
