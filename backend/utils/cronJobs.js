const cron = require('node-cron');
const supabase = require('../supabaseClient');

// Run every day at midnight (00:00)
// For testing every minute: '* * * * *'
// For production daily: '0 0 * * *'
const scheduleCleanup = () => {
    console.log('⏳ Cleanup job scheduled: Daily at 00:00');

    cron.schedule('0 0 * * *', async () => {
        console.log('🧹 Running automated cleanup job...');

        try {
            // 7 days ago
            const dateThreshold = new Date();
            dateThreshold.setDate(dateThreshold.getDate() - 7);

            // 1. Find expired messages with files
            const { data: expiredMessages, error: fetchError } = await supabase
                .from('messages')
                .select('id, file_url, content')
                .not('file_url', 'is', null)
                .lt('created_at', dateThreshold.toISOString());

            if (fetchError) {
                console.error('❌ Error fetching expired messages:', fetchError);
                return;
            }

            if (!expiredMessages || expiredMessages.length === 0) {
                console.log('✅ No expired files found to clean up.');
                return;
            }

            console.log(`Found ${expiredMessages.length} messages with expired files.`);

            // 2. Delete files from Storage
            const filesToDelete = expiredMessages.map(msg => {
                // Extract path from URL: .../storage/v1/object/public/chat-files/filename.jpg
                // Logic depends on how you construct the URL. Assuming standart Supabase public URL.
                // We need the path relative to the bucket.
                const urlParts = msg.file_url.split('/chat-files/');
                return urlParts.length > 1 ? urlParts[1] : null;
            }).filter(path => path !== null);

            if (filesToDelete.length > 0) {
                const { error: storageError } = await supabase
                    .storage
                    .from('chat-files')
                    .remove(filesToDelete);

                if (storageError) {
                    console.error('❌ Error deleting files from storage:', storageError);
                } else {
                    console.log(`🗑️ Deleted ${filesToDelete.length} files from storage.`);
                }
            }

            // 3. Update Database records
            const messageIds = expiredMessages.map(msg => msg.id);
            const { error: updateError } = await supabase
                .from('messages')
                .update({
                    file_url: null,
                    message_type: 'expired',
                    content: '⚠️ This file has expired and was automatically deleted.'
                })
                .in('id', messageIds);

            if (updateError) {
                console.error('❌ Error updating expired message records:', updateError);
            } else {
                console.log('✅ Database records updated.');
            }

        } catch (err) {
            console.error('❌ Unexpected error during cleanup job:', err);
        }
    });
};

module.exports = { scheduleCleanup };
