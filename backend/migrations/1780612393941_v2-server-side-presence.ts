import { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // ── 1. user_last_seen ──────────────────────────────────────────────────
  pgm.createTable('user_last_seen', {
    user_id: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'CASCADE',
      primaryKey: true,
    },
    last_seen_at: { type: 'timestamptz', default: 'NOW()' },
    status: { type: 'text', default: 'offline', check: "status IN ('online', 'away', 'offline')" },
  });

  pgm.addConstraint('user_last_seen', 'user_last_seen_status_check', {
    check: "status IN ('online', 'away', 'offline')",
  });

  // RLS
  pgm.sql('ALTER TABLE public.user_last_seen ENABLE ROW LEVEL SECURITY');
  pgm.sql('CREATE POLICY "Public read user_last_seen" ON public.user_last_seen FOR SELECT USING (true)');
  pgm.sql('CREATE POLICY "Service write user_last_seen" ON public.user_last_seen FOR ALL USING (auth.role() = \'service_role\')');

  // ── 2. room_read_state ────────────────────────────────────────────────
  pgm.createTable('room_read_state', {
    user_id: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    room_id: {
      type: 'uuid',
      references: 'rooms(id)',
      onDelete: 'CASCADE',
    },
    last_read_at: { type: 'timestamptz', default: 'NOW()' },
  });

  pgm.addConstraint('room_read_state', 'room_read_state_pkey', 'PRIMARY KEY (user_id, room_id)');

  // RLS
  pgm.sql('ALTER TABLE public.room_read_state ENABLE ROW LEVEL SECURITY');
  pgm.sql('CREATE POLICY "Own read room_read_state" ON public.room_read_state FOR SELECT USING (auth.uid() = user_id)');
  pgm.sql('CREATE POLICY "Own write room_read_state" ON public.room_read_state FOR INSERT WITH CHECK (auth.uid() = user_id)');
  pgm.sql('CREATE POLICY "Own update room_read_state" ON public.room_read_state FOR UPDATE USING (auth.uid() = user_id)');

  // ── 3. RPC: get_friends_last_seen ──────────────────────────────────
  pgm.sql(`
    CREATE OR REPLACE FUNCTION get_friends_last_seen(friend_ids UUID[])
    RETURNS TABLE(user_id UUID, last_seen_at TIMESTAMPTZ, status TEXT) AS $$
      SELECT user_id, last_seen_at, status FROM public.user_last_seen WHERE user_id = ANY(friend_ids);
    $$ LANGUAGE sql STABLE SECURITY DEFINER;
  `);

  // ── 4. RPC: get_room_read_state ─────────────────────────────────────
  pgm.sql(`
    CREATE OR REPLACE FUNCTION get_room_read_state(p_room_ids UUID[])
    RETURNS TABLE(room_id UUID, user_id UUID, last_read_at TIMESTAMPTZ) AS $$
      SELECT room_id, user_id, last_read_at FROM public.room_read_state
      WHERE user_id = auth.uid() AND room_id = ANY(p_room_ids);
    $$ LANGUAGE sql STABLE SECURITY DEFINER;
  `);

  // ── 5. index ─────────────────────────────────────────────────────────
  pgm.createIndex('room_read_state', ['room_id']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP FUNCTION IF EXISTS get_room_read_state(UUID[])');
  pgm.sql('DROP FUNCTION IF EXISTS get_friends_last_seen(UUID[])');
  pgm.dropTable('room_read_state');
  pgm.dropTable('user_last_seen');
}