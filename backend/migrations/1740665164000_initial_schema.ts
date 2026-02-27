import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
    // We use the existing setup.sql content, but stripped of BEGIN/COMMIT
    // and some publication drops that might be problematic if not superuser
    pgm.sql(`
-- 1. REALTIME PUBLICATION SETUP
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime;

-- 2. CORE TABLES
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  username TEXT UNIQUE,
  email TEXT,
  avatar_url TEXT,
  user_code INTEGER UNIQUE,
  bio TEXT,
  updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('private', 'dm')) DEFAULT 'private',
  avatar_url TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.room_members (
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  content TEXT,
  file_url TEXT,
  file_name TEXT,
  file_size BIGINT,
  message_type TEXT DEFAULT 'text',
  status TEXT CHECK (status IN ('sent', 'read')) DEFAULT 'sent',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.message_deletions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(message_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.room_deletions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(room_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.friends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  responded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(sender_id, receiver_id),
  CHECK (sender_id != receiver_id)
);

CREATE TABLE IF NOT EXISTS public.room_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  inviter_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  invitee_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  responded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(room_id, invitee_id)
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_users_user_code ON public.users(user_code);
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON public.friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user_room ON public.room_members(user_id, room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON public.room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages(room_id);
CREATE INDEX IF NOT EXISTS idx_room_deletions_user_id ON public.room_deletions(user_id);
CREATE INDEX IF NOT EXISTS idx_message_deletions_user_id ON public.message_deletions(user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver_status ON public.friend_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_room_invitations_invitee_status ON public.room_invitations(invitee_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_room_id_created_at ON public.messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_deletions_composite ON public.message_deletions(user_id, message_id);

-- 3.5 VIEWS
CREATE OR REPLACE VIEW public.friends_with_details AS
SELECT f.*, u.username, u.avatar_url, u.email, u.user_code FROM public.friends f JOIN public.users u ON f.friend_id = u.id;

CREATE OR REPLACE VIEW public.pending_friend_requests_with_details AS
SELECT fr.*, u.username as sender_name, u.avatar_url as sender_avatar, u.email as sender_email, u.user_code as sender_code FROM public.friend_requests fr JOIN public.users u ON fr.sender_id = u.id WHERE fr.status = 'pending';

CREATE OR REPLACE VIEW public.pending_invitations_with_details AS
SELECT ri.*, r.name as room_name, u.username as inviter_name, u.avatar_url as inviter_avatar FROM public.room_invitations ri JOIN public.rooms r ON ri.room_id = r.id JOIN public.users u ON ri.inviter_id = u.id WHERE ri.status = 'pending';

-- 4. FUNCTIONS
CREATE OR REPLACE FUNCTION generate_user_code() RETURNS INTEGER AS $$
DECLARE
    new_code INTEGER;
    code_exists BOOLEAN;
BEGIN
    LOOP
        new_code := floor(random() * 9000000 + 1000000)::INTEGER;
        SELECT EXISTS(SELECT 1 FROM public.users WHERE user_code = new_code) INTO code_exists;
        IF NOT code_exists THEN RETURN new_code; END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username, email, avatar_url, user_code)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://ui-avatars.com/api/?name=' || split_part(NEW.email, '@', 1)),
    generate_user_code()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION handle_friend_request_accepted() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    NEW.responded_at = timezone('utc'::text, now());
    INSERT INTO public.friends (user_id, friend_id) VALUES (NEW.sender_id, NEW.receiver_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.friends (user_id, friend_id) VALUES (NEW.receiver_id, NEW.sender_id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_invitation_accepted() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    NEW.responded_at = timezone('utc'::text, now());
    INSERT INTO public.room_members (room_id, user_id) VALUES (NEW.room_id, NEW.invitee_id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.auto_add_room_creator_as_member() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'private' THEN
    INSERT INTO public.room_members (room_id, user_id) VALUES (NEW.id, NEW.created_by) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION send_friend_request_by_code(target_code INTEGER) RETURNS JSON AS $$
DECLARE
  target_user_id UUID;
BEGIN
  SELECT id INTO target_user_id FROM public.users WHERE user_code = target_code LIMIT 1;
  IF target_user_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'User not found'); END IF;
  IF target_user_id = auth.uid() THEN RETURN json_build_object('success', false, 'error', 'Cannot add yourself'); END IF;
  INSERT INTO public.friend_requests (sender_id, receiver_id, status) VALUES (auth.uid(), target_user_id, 'pending');
  RETURN json_build_object('success', true, 'message', 'Friend request sent');
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('success', false, 'error', 'Request already sent');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_chat_init_data() RETURNS JSON AS $$
DECLARE
  uid UUID := auth.uid();
  res JSON;
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('error', 'User not authenticated'); END IF;
  SELECT json_build_object(
    'current_user', (SELECT row_to_json(u) FROM public.users u WHERE id = uid),
    'rooms', (SELECT json_agg(r_data) FROM (SELECT r.*, (SELECT json_agg(m_data) FROM (SELECT rm.user_id, u.username, u.avatar_url FROM public.room_members rm JOIN public.users u ON rm.user_id = u.id WHERE rm.room_id = r.id) m_data) as members FROM public.rooms r WHERE r.id IN (SELECT room_id FROM public.room_members WHERE user_id = uid) AND r.id NOT IN (SELECT room_id FROM public.room_deletions WHERE user_id = uid)) r_data),
    'room_deletions', (SELECT COALESCE(json_agg(rd.room_id), '[]'::json) FROM public.room_deletions rd WHERE user_id = uid),
    'message_deletions', (SELECT COALESCE(json_agg(md.message_id), '[]'::json) FROM public.message_deletions md WHERE user_id = uid),
    'friends', (SELECT COALESCE(json_agg(f), '[]'::json) FROM public.friends_with_details f WHERE user_id = uid),
    'friend_requests', (SELECT COALESCE(json_agg(fr), '[]'::json) FROM public.pending_friend_requests_with_details fr WHERE receiver_id = uid),
    'invitations', (SELECT COALESCE(json_agg(i), '[]'::json) FROM public.pending_invitations_with_details i WHERE invitee_id = uid),
    'last_messages', (SELECT COALESCE(json_agg(m_data), '[]'::json) FROM (SELECT m.*, u.username, u.avatar_url FROM public.rooms r JOIN LATERAL (SELECT * FROM public.messages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) m ON true JOIN public.users u ON m.user_id = u.id WHERE r.id IN (SELECT room_id FROM public.room_members WHERE user_id = uid) AND r.id NOT IN (SELECT room_id FROM public.room_deletions WHERE user_id = uid)) m_data)
  ) INTO res;
  RETURN res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_chat_messages(p_room_id UUID, p_limit INTEGER DEFAULT 50, p_before_created_at TIMESTAMPTZ DEFAULT NULL) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  current_user_id UUID := auth.uid();
  result JSON;
BEGIN
  IF current_user_id IS NULL THEN RETURN '[]'::json; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.room_members WHERE room_id = p_room_id AND user_id = current_user_id) THEN RETURN '[]'::json; END IF;
  SELECT COALESCE(json_agg(t), '[]'::json) INTO result FROM (SELECT m.* FROM public.messages m WHERE m.room_id = p_room_id AND (p_before_created_at IS NULL OR m.created_at < p_before_created_at) ORDER BY m.created_at DESC LIMIT p_limit) t;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION is_room_member(room_id UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS(SELECT 1 FROM public.room_members WHERE room_id = $1 AND user_id = auth.uid());
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 5. TRIGGERS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_friend_request_response ON public.friend_requests;
CREATE TRIGGER on_friend_request_response BEFORE UPDATE ON public.friend_requests FOR EACH ROW EXECUTE FUNCTION handle_friend_request_accepted();

DROP TRIGGER IF EXISTS on_invitation_response ON public.room_invitations;
CREATE TRIGGER on_invitation_response BEFORE UPDATE ON public.room_invitations FOR EACH ROW EXECUTE FUNCTION public.handle_invitation_accepted();

DROP TRIGGER IF EXISTS on_room_created_add_creator ON public.rooms;
CREATE TRIGGER on_room_created_add_creator AFTER INSERT ON public.rooms FOR EACH ROW WHEN (NEW.type = 'private') EXECUTE FUNCTION public.auto_add_room_creator_as_member();

-- 6. RLS POLICIES
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are public" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can view messages in their rooms" ON public.messages FOR SELECT USING (is_room_member(room_id));
CREATE POLICY "Users can insert messages in their rooms" ON public.messages FOR INSERT WITH CHECK (is_room_member(room_id));
CREATE POLICY "Users can delete own messages" ON public.messages FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Members see private rooms" ON public.rooms FOR SELECT USING (id IN (SELECT room_id FROM public.room_members WHERE user_id = auth.uid()));
CREATE POLICY "Auth users create rooms" ON public.rooms FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Owners can update rooms" ON public.rooms FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "View members" ON public.room_members FOR SELECT USING (EXISTS (SELECT 1 FROM public.room_members rm WHERE rm.room_id = room_members.room_id AND rm.user_id = auth.uid()));
CREATE POLICY "Self join" ON public.room_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can add members" ON public.room_members FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.created_by = auth.uid()));
CREATE POLICY "Owners or self can remove members" ON public.room_members FOR DELETE USING (EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.created_by = auth.uid()) OR auth.uid() = user_id);

-- 6.5 STORAGE SETUP (Requires bucket manually usually, but inserting records)
-- (Skipping buckets insert here as it might conflict with existing Supabase storage management)

-- 7. REALTIME ENABLEMENT
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friends;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_invitations;
  `);

}

export async function down(pgm: MigrationBuilder): Promise<void> {
    pgm.sql(`
    DROP VIEW IF EXISTS public.friends_with_details;
    DROP VIEW IF EXISTS public.pending_friend_requests_with_details;
    DROP VIEW IF EXISTS public.pending_invitations_with_details;
    
    -- Drop triggers first
    DROP TRIGGER IF EXISTS on_room_created_add_creator ON public.rooms;
    DROP TRIGGER IF EXISTS on_invitation_response ON public.room_invitations;
    DROP TRIGGER IF EXISTS on_friend_request_response ON public.friend_requests;
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

    -- Drop tables in order
    DROP TABLE IF EXISTS public.room_invitations;
    DROP TABLE IF EXISTS public.friend_requests;
    DROP TABLE IF EXISTS public.friends;
    DROP TABLE IF EXISTS public.room_deletions;
    DROP TABLE IF EXISTS public.message_deletions;
    DROP TABLE IF EXISTS public.messages;
    DROP TABLE IF EXISTS public.room_members;
    DROP TABLE IF EXISTS public.rooms;
    DROP TABLE IF EXISTS public.users;

    -- Drop functions
    DROP FUNCTION IF EXISTS is_room_member;
    DROP FUNCTION IF EXISTS get_chat_messages;
    DROP FUNCTION IF EXISTS get_chat_init_data;
    DROP FUNCTION IF EXISTS send_friend_request_by_code;
    DROP FUNCTION IF EXISTS auto_add_room_creator_as_member;
    DROP FUNCTION IF EXISTS handle_invitation_accepted;
    DROP FUNCTION IF EXISTS handle_friend_request_accepted;
    DROP FUNCTION IF EXISTS handle_new_user;
    DROP FUNCTION IF EXISTS generate_user_code;

    -- Cleanup publication if needed (Optional)
    DROP PUBLICATION IF EXISTS supabase_realtime;
  `);
}
