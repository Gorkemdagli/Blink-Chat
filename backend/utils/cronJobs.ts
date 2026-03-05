import cron from 'node-cron';
import supabase from '../supabaseClient';

// ─── Path Traversal Guard ────────────────────────────────────────────────────
/**
 * Extracts a safe storage path from a Supabase file_url.
 * Returns null if the path contains traversal sequences or looks malicious.
 *
 * Valid:   https://.../storage/v1/object/public/chat-files/abc/file.png
 * Invalid: https://.../chat-files/../avatars/secret  → null (traversal)
 * Invalid: https://.../chat-files//etc/passwd         → null (absolute-like)
 */
export function extractStoragePath(fileUrl: string): string | null {
    if (!fileUrl || typeof fileUrl !== 'string') return null;

    const BUCKET_SEGMENT = '/chat-files/';
    const idx = fileUrl.indexOf(BUCKET_SEGMENT);
    if (idx === -1) return null;

    const rawPath = fileUrl.slice(idx + BUCKET_SEGMENT.length);

    // Block path traversal sequences
    if (rawPath.includes('..')) {
        console.error(`❌ [SECURITY] Path traversal attempt blocked: ${rawPath}`);
        return null;
    }

    // Block absolute-like paths
    if (rawPath.startsWith('/')) {
        console.error(`❌ [SECURITY] Absolute path attempt blocked: ${rawPath}`);
        return null;
    }

    // Block empty or whitespace-only paths
    const trimmed = rawPath.trim();
    if (!trimmed) return null;

    // Block null bytes
    if (trimmed.includes('\x00')) {
        console.error(`❌ [SECURITY] Null byte in path blocked: ${trimmed}`);
        return null;
    }

    return trimmed;
}

// Core cleanup logic - exported to be run manually or on startup
export const runCleanup = async () => {
    console.log('🧹 Running automated cleanup job...');

    try {
        // 15 days ago
        const dateThreshold = new Date();
        dateThreshold.setDate(dateThreshold.getDate() - 15);

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

        // 2. Delete files from Storage (with path traversal protection)
        const filesToDelete = expiredMessages
            .map((msg: any) => extractStoragePath(msg.file_url))
            .filter((path): path is string => path !== null);

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
        const messageIds = expiredMessages.map((msg: any) => msg.id);
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

        // 4. CLEANUP ORPHAN FILES (New logic to catch files not in messages table)
        console.log('🔍 Checking for orphan/old files directly in storage...');

        // Helper to clean a specific folder in the bucket
        const cleanFolder = async (folderPath: string = '') => {
            const { data: files, error: listError } = await supabase
                .storage
                .from('chat-files')
                .list(folderPath, {
                    limit: 100,
                    sortBy: { column: 'created_at', order: 'asc' }
                });

            if (listError) {
                console.error(`❌ Error listing files in ${folderPath || 'root'}:`, listError);
                return;
            }

            if (!files || files.length === 0) return;

            const now = new Date();
            const olderThan15Days = files.filter(file => {
                const createdAt = new Date(file.created_at);
                const isOld = (now.getTime() - createdAt.getTime()) > (15 * 24 * 60 * 60 * 1000);
                return isOld && file.id;
            });

            if (olderThan15Days.length > 0) {
                const pathsToDelete = olderThan15Days
                    .map(f => {
                        const name = f.name ?? '';
                        // Guard: skip suspicious file names in storage listing
                        if (name.includes('..') || name.startsWith('/') || name.includes('\x00')) {
                            console.error(`❌ [SECURITY] Suspicious filename skipped: ${name}`);
                            return null;
                        }
                        return folderPath ? `${folderPath}/${name}` : name;
                    })
                    .filter((p): p is string => p !== null);
                const { error: deleteError } = await supabase
                    .storage
                    .from('chat-files')
                    .remove(pathsToDelete);

                if (deleteError) {
                    console.error(`❌ Error deleting ${pathsToDelete.length} orphan files:`, deleteError);
                } else {
                    console.log(`🗑️ Deleted ${pathsToDelete.length} orphan files from ${folderPath || 'root'}.`);
                }
            }
        };

        // Clean root and subfolders
        await cleanFolder(); // Root
        await cleanFolder('avatars'); // Avatars folder (though profiles are exempt, other files might be there)

    } catch (err) {
        console.error('❌ Unexpected error during cleanup job:', err);
    }
};

// Scheduled job
// Run every day at midnight (00:00)
export const scheduleCleanup = () => {
    console.log('⏳ Cleanup job scheduled: Daily at 00:00');

    cron.schedule('0 0 * * *', () => {
        runCleanup();
    });
};
