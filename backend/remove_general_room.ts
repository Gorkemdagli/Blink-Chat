import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    await client.connect();

    try {
        console.log('Dropping trigger...');
        await client.query(`DROP TRIGGER IF EXISTS on_user_created_add_to_general ON public.users;`);

        console.log('Dropping function...');
        await client.query(`DROP FUNCTION IF EXISTS public.add_new_user_to_general_room();`);

        console.log('Deleting general room members...');
        await client.query(`DELETE FROM public.room_members WHERE room_id = '00000000-0000-0000-0000-000000000000';`);

        console.log('Deleting general room...');
        await client.query(`DELETE FROM public.rooms WHERE id = '00000000-0000-0000-0000-000000000000';`);

        console.log('Success! General room and its auto-join logic have been removed.');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

run();
