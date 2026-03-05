import { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
    pgm.sql(`
CREATE OR REPLACE FUNCTION public.is_room_creator(check_room_id UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS(SELECT 1 FROM public.rooms WHERE id = $1 AND created_by = auth.uid());
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_room_member(room_id UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS(SELECT 1 FROM public.room_members WHERE room_id = $1 AND user_id = auth.uid());
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Odalar (rooms) tablosu okuma politikasını düzelt
DROP POLICY IF EXISTS "Members see private rooms" ON public.rooms;
CREATE POLICY "Members see private rooms" ON public.rooms FOR SELECT USING (
  is_room_member(id) OR created_by = auth.uid()
);

-- Oda üyeleri (room_members) politikalarındaki sonsuz döngüleri düzelt
DROP POLICY IF EXISTS "View members" ON public.room_members;
CREATE POLICY "View members" ON public.room_members FOR SELECT USING (
  is_room_member(room_id)
);

DROP POLICY IF EXISTS "Owners can add members" ON public.room_members;
CREATE POLICY "Owners can add members" ON public.room_members FOR INSERT WITH CHECK (
  is_room_creator(room_id)
);

DROP POLICY IF EXISTS "Owners or self can remove members" ON public.room_members;
CREATE POLICY "Owners or self can remove members" ON public.room_members FOR DELETE USING (
  is_room_creator(room_id) OR auth.uid() = user_id
);
    `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
    pgm.sql(`
DROP POLICY IF EXISTS "Members see private rooms" ON public.rooms;
CREATE POLICY "Members see private rooms" ON public.rooms FOR SELECT USING (id IN (SELECT room_id FROM public.room_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "View members" ON public.room_members;
CREATE POLICY "View members" ON public.room_members FOR SELECT USING (EXISTS (SELECT 1 FROM public.room_members rm WHERE rm.room_id = room_members.room_id AND rm.user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can add members" ON public.room_members;
CREATE POLICY "Owners can add members" ON public.room_members FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.created_by = auth.uid()));

DROP POLICY IF EXISTS "Owners or self can remove members" ON public.room_members;
CREATE POLICY "Owners or self can remove members" ON public.room_members FOR DELETE USING (EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.created_by = auth.uid()) OR auth.uid() = user_id);
    `);
}
