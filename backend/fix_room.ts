/** Fix missing room */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixMissingRoom() {
    const roomId = '00000000-0000-0000-0000-000000000000';

    // Create room if it doesn't exist
    const { data, error } = await supabase
        .from('rooms')
        .insert([{ id: roomId, name: 'Genel', type: 'private' }])
        .select();

    if (error && error.code !== '23505') { // Ignore unique violation error
        console.error('Failed to create room:', error);
    } else {
        console.log('Room created or already exists:', data || 'already exists');
    }

    // Also manually add ALL users to General room if they are missing
    const { data: users, error: usersError } = await supabase.from('users').select('id');
    if (usersError) {
        console.error('Failed to get users:', usersError);
        return;
    }

    for (const user of users) {
        const { error: memberError } = await supabase
            .from('room_members')
            .insert([{ room_id: roomId, user_id: user.id }])
            .select();

        if (memberError && memberError.code !== '23505') {
            console.error(`Failed to add user ${user.id} to room:`, memberError);
        }
    }

    console.log('Finished missing room fix.');
}

fixMissingRoom().catch(console.error);
