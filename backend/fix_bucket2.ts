import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixBucket() {
    try {
        const { data, error } = await supabase.storage.updateBucket('chat-files', {
            allowedMimeTypes: [
                'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
                'application/pdf', 'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'text/plain', 'video/mp4', 'audio/mpeg',
                'application/zip', 'application/x-zip-compressed'
            ],
            public: true
        });

        if (error) {
            console.error('Error updating bucket:', error);
        } else {
            console.log('Successfully updated bucket chat-files:', data);
        }
    } catch (e) {
        console.error('Exception:', e);
    }
}

fixBucket();
