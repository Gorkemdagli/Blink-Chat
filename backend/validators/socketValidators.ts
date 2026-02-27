import { z } from 'zod';

const ALLOWED_FILE_EXTENSIONS = [
    'jpg', 'jpeg', 'png', 'gif', 'webp',
    'pdf', 'doc', 'docx', 'txt', 'mp4', 'mp3', 'zip', 'rar'
];

export const MessageDataSchema = z.object({
    roomId: z.string().min(1, 'Room ID is required'),
    userId: z.string().min(1, 'User ID is required'),
    content: z.string(),
    fileUrl: z.string().url().optional().nullable(),
    messageType: z.enum(['text', 'image', 'file']).optional().default('text'),
    fileName: z.string().optional().nullable().refine(name => {
        if (!name) return true;
        const ext = name.split('.').pop()?.toLowerCase();
        return ext && ALLOWED_FILE_EXTENSIONS.includes(ext);
    }, { message: "Geçersiz dosya uzantısı" }),
    fileSize: z.number().max(25 * 1024 * 1024, "Dosya boyutu 25MB'ı aşamaz").optional().nullable()
}).refine(data => data.content.trim().length > 0 || !!data.fileUrl, {
    message: "Content or file url must be provided",
    path: ["content"]
});

export const MarkReadSchema = z.object({
    roomId: z.string().min(1, 'Room ID is required'),
    userId: z.string().min(1, 'User ID is required')
});

export const TypingSchema = z.object({
    roomId: z.string().min(1, 'Room ID is required'),
    userId: z.string().min(1, 'User ID is required'),
    username: z.string().min(1, 'Username is required')
});

export const StopTypingSchema = z.object({
    roomId: z.string().min(1, 'Room ID is required'),
    userId: z.string().min(1, 'User ID is required')
});
