import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    await client.connect();

    try {
        console.log('Updating allowed_mime_types for chat-files bucket...');

        // Add image/heic, image/heif to the bucket
        await client.query(`
      UPDATE storage.buckets 
      SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'video/mp4', 'audio/mpeg', 'application/zip', 'application/x-zip-compressed']::text[]
      WHERE id = 'chat-files';
    `);

        console.log('Success! HEIC/HEIF options added to chat-files bucket.');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

run();
