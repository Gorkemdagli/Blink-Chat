import { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION delete_message(p_message_id UUID, p_user_id UUID)
    RETURNS BOOLEAN AS $$
    DECLARE
      v_member_count INTEGER;
      v_deletion_count INTEGER;
      v_file_url TEXT;
      v_file_path TEXT;
    BEGIN
      -- Insert soft deletion (idempotent — ON CONFLICT DO NOTHING)
      INSERT INTO message_deletions (message_id, user_id)
      VALUES (p_message_id, p_user_id)
      ON CONFLICT (message_id, user_id) DO NOTHING;

      -- Get file URL before hard delete
      SELECT file_url INTO v_file_url FROM messages WHERE id = p_message_id;

      -- Count members and deletions atomically
      SELECT COUNT(*) INTO v_member_count
      FROM room_members
      WHERE room_id = (SELECT room_id FROM messages WHERE id = p_message_id);

      SELECT COUNT(*) INTO v_deletion_count
      FROM message_deletions
      WHERE message_id = p_message_id;

      -- Hard delete only if ALL members have deleted
      IF v_deletion_count >= v_member_count THEN
        -- Delete from storage.objects if file exists
        IF v_file_url IS NOT NULL THEN
          -- Extract path after 'chat-files/' and URL-decode
          v_file_path := (SELECT (regexp_matches(v_file_url, 'chat-files/([^?]+)'))[1]);
          -- URL decode: replace %20 and + with space
          v_file_path := replace(replace(v_file_path, '%20', ' '), '+', ' ');

          DELETE FROM storage.objects
          WHERE name = v_file_path AND bucket_id = 'chat-files';
        END IF;

        -- Hard delete message (cascade deletes message_deletions rows)
        DELETE FROM messages WHERE id = p_message_id;
        RETURN TRUE;
      END IF;

      RETURN FALSE;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP FUNCTION IF EXISTS delete_message(UUID, UUID)');
}