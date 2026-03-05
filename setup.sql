-- ============================================
-- 💬 CHAT APP - COMPLETE SUPABASE SCHEMA (v3.0 - Synced from live DB)
-- ============================================
-- Bu dosya, uygulamanın çalışması için gereken tüm veritabanı yapısını içerir.
-- Supabase Dashboard > SQL Editor'a kopyalayıp çalıştırın.
-- 2026-03-05: Synced with live Supabase export. Added: are_friends, check_and_delete triggers,
--             search_user_by_code, updated send_friend_request_by_code, new views, new indexes.
-- ============================================

BEGIN;

-- ============================================
-- 1. REALTIME PUBLICATION SETUP
-- ============================================
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime;

-- ============================================
-- 2. CORE TABLES
-- ============================================

-- Users table (synced with auth.users)
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

-- Rooms table
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('public', 'private', 'dm')) DEFAULT 'private',
  avatar_url TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Room members table
CREATE TABLE IF NOT EXISTS public.room_members (
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (room_id, user_id)
);

-- Messages table
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

-- Message deletions table
CREATE TABLE IF NOT EXISTS public.message_deletions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(message_id, user_id)
);

-- Room deletions table
CREATE TABLE IF NOT EXISTS public.room_deletions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(room_id, user_id)
);

-- Friends table
CREATE TABLE IF NOT EXISTS public.friends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

-- Friend requests table
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

-- Room invitations table
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

-- ============================================
-- 3. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_user_code ON public.users(user_code);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON public.friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user_room ON public.room_members(user_id, room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON public.room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_room_id_created_at ON public.messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_deletions_user_id ON public.room_deletions(user_id);
CREATE INDEX IF NOT EXISTS idx_message_deletions_user_id ON public.message_deletions(user_id);
CREATE INDEX IF NOT EXISTS idx_message_deletions_user_message ON public.message_deletions(user_id, message_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver_status ON public.friend_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON public.friend_requests(receiver_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON public.friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_room_invitations_invitee_status ON public.room_invitations(invitee_id, status);
CREATE INDEX IF NOT EXISTS idx_room_invitations_invitee ON public.room_invitations(invitee_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_room_invitations_room ON public.room_invitations(room_id);
CREATE INDEX IF NOT EXISTS idx_rooms_type_created_by ON public.rooms(type, created_by);

-- ============================================
-- 4. VIEWS
-- ============================================

CREATE OR REPLACE VIEW public.friends_with_details AS
SELECT
    f.*,
    u.username,
    u.avatar_url,
    u.email,
    u.user_code
FROM public.friends f
JOIN public.users u ON f.friend_id = u.id;

CREATE OR REPLACE VIEW public.pending_friend_requests_with_details AS
SELECT
    fr.*,
    u.username as sender_name,
    u.avatar_url as sender_avatar,
    u.email as sender_email,
    u.user_code as sender_code
FROM public.friend_requests fr
JOIN public.users u ON fr.sender_id = u.id
WHERE fr.status = 'pending';

CREATE OR REPLACE VIEW public.pending_invitations_with_details AS
SELECT
    ri.*,
    r.name as room_name,
    u.username as inviter_name,
    u.avatar_url as inviter_avatar
FROM public.room_invitations ri
JOIN public.rooms r ON ri.room_id = r.id
JOIN public.users u ON ri.inviter_id = u.id
WHERE ri.status = 'pending';

-- View: Rooms a user has access to
CREATE OR REPLACE VIEW public.user_accessible_rooms AS
SELECT
    r.id, r.name, r.type, r.created_by, r.created_at,
    rm.joined_at,
    CASE WHEN r.created_by = auth.uid() THEN true ELSE false END AS is_owner,
    CASE WHEN rm.user_id IS NOT NULL THEN true ELSE false END AS is_member
FROM public.rooms r
LEFT JOIN public.room_members rm ON r.id = rm.room_id AND rm.user_id = auth.uid()
WHERE (r.type IN ('private', 'dm') AND rm.user_id = auth.uid());

-- View: User search
CREATE OR REPLACE VIEW public.user_search_view AS
SELECT
    id, username, email, user_code, avatar_url, created_at,
    concat('#', user_code::text) AS formatted_code
FROM public.users;

-- View: Email visibility based on friendship
CREATE OR REPLACE VIEW public.users_with_email AS
SELECT
    id, username, avatar_url, user_code, created_at, updated_at,
    CASE
        WHEN id = auth.uid() THEN email
        WHEN EXISTS (
            SELECT 1 FROM public.friends f
            WHERE (f.user_id = auth.uid() AND f.friend_id = u.id)
               OR (f.friend_id = auth.uid() AND f.user_id = u.id)
        ) THEN email
        ELSE NULL
    END AS email
FROM public.users u;

-- ============================================
-- 5. FUNCTIONS
-- ============================================

-- Generate 7-digit user code
CREATE OR REPLACE FUNCTION public.generate_user_code()
RETURNS INTEGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  suffix INTEGER := 0;
BEGIN
  base_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  final_username := base_username;

  WHILE EXISTS (SELECT 1 FROM public.users WHERE username = final_username) LOOP
    suffix := suffix + 1;
    final_username := base_username || suffix::TEXT;
  END LOOP;

  INSERT INTO public.users (id, username, email, avatar_url, user_code)
  VALUES (
    NEW.id,
    final_username,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://ui-avatars.com/api/?name=' || split_part(NEW.email, '@', 1)),
    generate_user_code()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Check if two users are friends
CREATE OR REPLACE FUNCTION public.are_friends(user1_id UUID, user2_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM public.friends
    WHERE (user_id = user1_id AND friend_id = user2_id)
       OR (user_id = user2_id AND friend_id = user1_id)
  );
END;
$$ LANGUAGE plpgsql;

-- Handle friend request accepted/rejected
CREATE OR REPLACE FUNCTION public.handle_friend_request_accepted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    NEW.responded_at = timezone('utc'::text, now());
    INSERT INTO public.friends (user_id, friend_id) VALUES (NEW.sender_id, NEW.receiver_id) ON CONFLICT (user_id, friend_id) DO NOTHING;
    INSERT INTO public.friends (user_id, friend_id) VALUES (NEW.receiver_id, NEW.sender_id) ON CONFLICT (user_id, friend_id) DO NOTHING;
  END IF;
  IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    NEW.responded_at = timezone('utc'::text, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Handle room invitation accepted/rejected
CREATE OR REPLACE FUNCTION public.handle_invitation_accepted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    NEW.responded_at = timezone('utc'::text, now());
    INSERT INTO public.room_members (room_id, user_id) VALUES (NEW.room_id, NEW.invitee_id) ON CONFLICT DO NOTHING;
  END IF;
  IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    NEW.responded_at = timezone('utc'::text, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add creator as member when room is created
CREATE OR REPLACE FUNCTION public.auto_add_room_creator_as_member()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'private' AND NEW.created_by IS NOT NULL THEN
    INSERT INTO public.room_members (room_id, user_id) VALUES (NEW.id, NEW.created_by) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete room if no members remain
CREATE OR REPLACE FUNCTION public.check_room_empty_and_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.room_members WHERE room_id = OLD.room_id) THEN
    DELETE FROM public.rooms WHERE id = OLD.room_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permanently delete message when all members have deleted it
CREATE OR REPLACE FUNCTION public.check_and_delete_message()
RETURNS TRIGGER AS $$
DECLARE
    v_room_id UUID;
    v_total_members INTEGER;
    v_total_deletions INTEGER;
BEGIN
    SELECT room_id INTO v_room_id FROM public.messages WHERE id = NEW.message_id;
    SELECT COUNT(*) INTO v_total_members FROM public.room_members WHERE room_id = v_room_id;
    SELECT COUNT(*) INTO v_total_deletions FROM public.message_deletions WHERE message_id = NEW.message_id;
    IF v_total_members > 0 AND v_total_deletions >= v_total_members THEN
        DELETE FROM public.messages WHERE id = NEW.message_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Permanently delete room when all members have deleted it
CREATE OR REPLACE FUNCTION public.check_and_delete_room()
RETURNS TRIGGER AS $$
DECLARE
    v_total_members INTEGER;
    v_total_deletions INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_members FROM public.room_members WHERE room_id = NEW.room_id;
    SELECT COUNT(*) INTO v_total_deletions FROM public.room_deletions WHERE room_id = NEW.room_id;
    IF v_total_members > 0 AND v_total_deletions >= v_total_members THEN
        DELETE FROM public.rooms WHERE id = NEW.room_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Send friend request by 7-digit code (with full validation)
CREATE OR REPLACE FUNCTION public.send_friend_request_by_code(target_code INTEGER)
RETURNS JSON AS $$
DECLARE
  target_user_id UUID;
  existing_friendship BOOLEAN;
  existing_request BOOLEAN;
BEGIN
  SELECT id INTO target_user_id FROM public.users WHERE user_code = target_code LIMIT 1;
  IF target_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;
  IF target_user_id = auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Cannot add yourself');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.friends
    WHERE user_id = auth.uid() AND friend_id = target_user_id
  ) INTO existing_friendship;
  IF existing_friendship THEN
    RETURN json_build_object('success', false, 'error', 'Already friends');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.friend_requests
    WHERE sender_id = auth.uid() AND receiver_id = target_user_id AND status = 'pending'
  ) INTO existing_request;
  IF existing_request THEN
    RETURN json_build_object('success', false, 'error', 'Request already sent');
  END IF;

  INSERT INTO public.friend_requests (sender_id, receiver_id, status)
  VALUES (auth.uid(), target_user_id, 'pending');

  RETURN json_build_object('success', true, 'message', 'Friend request sent', 'user_id', target_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Search user by 7-digit code
CREATE OR REPLACE FUNCTION public.search_user_by_code(search_code INTEGER)
RETURNS TABLE(id UUID, username TEXT, email TEXT, user_code INTEGER, avatar_url TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.username, u.email, u.user_code, u.avatar_url
    FROM public.users u
    WHERE u.user_code = search_code
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optimized initial data fetch RPC
CREATE OR REPLACE FUNCTION public.get_chat_init_data()
RETURNS JSON AS $$
DECLARE
  uid UUID := auth.uid();
  res JSON;
BEGIN
  IF uid IS NULL THEN
    RETURN json_build_object('error', 'User not authenticated');
  END IF;

  SELECT json_build_object(
    'current_user', (SELECT row_to_json(u) FROM public.users u WHERE id = uid),
    'rooms', (
      SELECT json_agg(r_data) FROM (
        SELECT r.*,
               (
                 SELECT json_agg(m_data) FROM (
                   SELECT rm.user_id, u.username, u.avatar_url
                   FROM public.room_members rm
                   JOIN public.users u ON rm.user_id = u.id
                   WHERE rm.room_id = r.id
                 ) m_data
               ) as members
        FROM public.rooms r
        WHERE r.id IN (SELECT room_id FROM public.room_members WHERE user_id = uid)
          AND r.id NOT IN (SELECT room_id FROM public.room_deletions WHERE user_id = uid)
      ) r_data
    ),
    'room_deletions', (SELECT COALESCE(json_agg(rd.room_id), '[]'::json) FROM public.room_deletions rd WHERE user_id = uid),
    'message_deletions', (SELECT COALESCE(json_agg(md.message_id), '[]'::json) FROM public.message_deletions md WHERE user_id = uid),
    'friends', (SELECT COALESCE(json_agg(f), '[]'::json) FROM public.friends_with_details f WHERE user_id = uid),
    'friend_requests', (SELECT COALESCE(json_agg(fr), '[]'::json) FROM public.pending_friend_requests_with_details fr WHERE receiver_id = uid),
    'invitations', (SELECT COALESCE(json_agg(i), '[]'::json) FROM public.pending_invitations_with_details i WHERE invitee_id = uid),
    'last_messages', (
      SELECT COALESCE(json_agg(m_data), '[]'::json) FROM (
        SELECT m.*, u.username, u.avatar_url
        FROM public.rooms r
        JOIN LATERAL (
          SELECT * FROM public.messages
          WHERE room_id = r.id
          ORDER BY created_at DESC
          LIMIT 1
        ) m ON true
        JOIN public.users u ON m.user_id = u.id
        WHERE r.id IN (SELECT room_id FROM public.room_members WHERE user_id = uid)
          AND r.id NOT IN (SELECT room_id FROM public.room_deletions WHERE user_id = uid)
      ) m_data
    )
  ) INTO res;

  RETURN res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optimized message loading RPC with cursor pagination
CREATE OR REPLACE FUNCTION public.get_chat_messages(
  p_room_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_before_created_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  result JSON;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN '[]'::json;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = p_room_id AND user_id = current_user_id
  ) THEN
    RETURN '[]'::json;
  END IF;

  SELECT COALESCE(json_agg(t), '[]'::json)
  INTO result
  FROM (
    SELECT m.*
    FROM public.messages m
    WHERE m.room_id = p_room_id
      AND (p_before_created_at IS NULL OR m.created_at < p_before_created_at)
    ORDER BY m.created_at DESC
    LIMIT p_limit
  ) t;

  RETURN result;
END;
$$;

-- Add new user to General room
CREATE OR REPLACE FUNCTION public.add_new_user_to_general_room()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.room_members (room_id, user_id)
    VALUES ('00000000-0000-0000-0000-000000000000', NEW.id)
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_friend_request_response ON public.friend_requests;
CREATE TRIGGER on_friend_request_response
  BEFORE UPDATE ON public.friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_friend_request_accepted();

DROP TRIGGER IF EXISTS on_invitation_response ON public.room_invitations;
CREATE TRIGGER on_invitation_response
  BEFORE UPDATE ON public.room_invitations
  FOR EACH ROW EXECUTE FUNCTION public.handle_invitation_accepted();

DROP TRIGGER IF EXISTS on_room_created_add_creator ON public.rooms;
CREATE TRIGGER on_room_created_add_creator
  AFTER INSERT ON public.rooms
  FOR EACH ROW WHEN (NEW.type = 'private')
  EXECUTE FUNCTION public.auto_add_room_creator_as_member();

DROP TRIGGER IF EXISTS on_room_member_left_checkout_empty ON public.room_members;
CREATE TRIGGER on_room_member_left_checkout_empty
  AFTER DELETE ON public.room_members
  FOR EACH ROW EXECUTE FUNCTION public.check_room_empty_and_delete();

DROP TRIGGER IF EXISTS trigger_check_and_delete_message ON public.message_deletions;
CREATE TRIGGER trigger_check_and_delete_message
  AFTER INSERT ON public.message_deletions
  FOR EACH ROW EXECUTE FUNCTION public.check_and_delete_message();

DROP TRIGGER IF EXISTS trigger_check_and_delete_room ON public.room_deletions;
CREATE TRIGGER trigger_check_and_delete_room
  AFTER INSERT ON public.room_deletions
  FOR EACH ROW EXECUTE FUNCTION public.check_and_delete_room();

DROP TRIGGER IF EXISTS on_user_created_add_to_general ON public.users;
CREATE TRIGGER on_user_created_add_to_general
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.add_new_user_to_general_room();

-- ============================================
-- 7. RLS POLICIES
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_deletions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_deletions ENABLE ROW LEVEL SECURITY;

-- Helper functions for non-recursive RLS
CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.room_members WHERE room_id = p_room_id AND user_id = auth.uid());
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_room_creator(p_room_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.rooms WHERE id = p_room_id AND created_by = auth.uid());
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Users
DROP POLICY IF EXISTS "Profiles are public" ON public.users;
CREATE POLICY "Profiles are public" ON public.users FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Rooms
DROP POLICY IF EXISTS "rooms_select_policy" ON public.rooms;
DROP POLICY IF EXISTS "Members see private rooms" ON public.rooms;
CREATE POLICY "rooms_select_policy" ON public.rooms FOR SELECT USING (
  created_by = auth.uid() OR is_room_member(id)
);
DROP POLICY IF EXISTS "rooms_insert_policy" ON public.rooms;
DROP POLICY IF EXISTS "Auth users create rooms" ON public.rooms;
CREATE POLICY "rooms_insert_policy" ON public.rooms FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "rooms_update_policy" ON public.rooms;
DROP POLICY IF EXISTS "Owners can update rooms" ON public.rooms;
CREATE POLICY "rooms_update_policy" ON public.rooms FOR UPDATE USING (created_by = auth.uid());

-- Room Members
DROP POLICY IF EXISTS "members_select_policy" ON public.room_members;
DROP POLICY IF EXISTS "View members" ON public.room_members;
CREATE POLICY "members_select_policy" ON public.room_members FOR SELECT USING (
  is_room_member(room_id)
);
DROP POLICY IF EXISTS "members_insert_policy" ON public.room_members;
DROP POLICY IF EXISTS "Self join" ON public.room_members;
DROP POLICY IF EXISTS "Owners can add members" ON public.room_members;
CREATE POLICY "members_insert_policy" ON public.room_members FOR INSERT WITH CHECK (
  auth.uid() = user_id OR is_room_creator(room_id)
);
DROP POLICY IF EXISTS "members_delete_policy" ON public.room_members;
DROP POLICY IF EXISTS "Owners or self can remove members" ON public.room_members;
CREATE POLICY "members_delete_policy" ON public.room_members FOR DELETE USING (
  auth.uid() = user_id OR is_room_creator(room_id)
);

-- Messages
DROP POLICY IF EXISTS "messages_select_policy" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages in their rooms" ON public.messages;
CREATE POLICY "messages_select_policy" ON public.messages FOR SELECT USING (is_room_member(room_id));
DROP POLICY IF EXISTS "messages_insert_policy" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages in their rooms" ON public.messages;
CREATE POLICY "messages_insert_policy" ON public.messages FOR INSERT WITH CHECK (is_room_member(room_id));
DROP POLICY IF EXISTS "messages_delete_policy" ON public.messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;
CREATE POLICY "messages_delete_policy" ON public.messages FOR DELETE USING (auth.uid() = user_id);

-- Friends
DROP POLICY IF EXISTS "Users can view their own friends" ON public.friends;
CREATE POLICY "Users can view their own friends" ON public.friends
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
DROP POLICY IF EXISTS "Users can create friendships" ON public.friends;
CREATE POLICY "Users can create friendships" ON public.friends
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);
DROP POLICY IF EXISTS "Users can delete their friendships" ON public.friends;
CREATE POLICY "Users can delete their friendships" ON public.friends
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Friend Requests
DROP POLICY IF EXISTS "Users can view sent friend requests" ON public.friend_requests;
CREATE POLICY "Users can view sent friend requests" ON public.friend_requests
  FOR SELECT USING (auth.uid() = sender_id);
DROP POLICY IF EXISTS "Users can view received friend requests" ON public.friend_requests;
CREATE POLICY "Users can view received friend requests" ON public.friend_requests
  FOR SELECT USING (auth.uid() = receiver_id);
DROP POLICY IF EXISTS "Users can send friend requests" ON public.friend_requests;
CREATE POLICY "Users can send friend requests" ON public.friend_requests
  FOR INSERT WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS "Receivers can update friend requests" ON public.friend_requests;
CREATE POLICY "Receivers can update friend requests" ON public.friend_requests
  FOR UPDATE USING (auth.uid() = receiver_id);
DROP POLICY IF EXISTS "Senders can delete pending requests" ON public.friend_requests;
CREATE POLICY "Senders can delete pending requests" ON public.friend_requests
  FOR DELETE USING (auth.uid() = sender_id AND status = 'pending');

-- Room Invitations
DROP POLICY IF EXISTS "Room creators can send invitations to private rooms." ON public.room_invitations;
CREATE POLICY "Room creators can send invitations to private rooms." ON public.room_invitations
  FOR INSERT WITH CHECK (
    auth.uid() = inviter_id AND
    EXISTS (SELECT 1 FROM public.rooms WHERE id = room_invitations.room_id AND created_by = auth.uid() AND type IN ('private', 'public'))
  );
DROP POLICY IF EXISTS "Room creators can view invitations they sent." ON public.room_invitations;
CREATE POLICY "Room creators can view invitations they sent." ON public.room_invitations
  FOR SELECT USING (auth.uid() = inviter_id);
DROP POLICY IF EXISTS "Users can view invitations sent to them." ON public.room_invitations;
CREATE POLICY "Users can view invitations sent to them." ON public.room_invitations
  FOR SELECT USING (auth.uid() = invitee_id);
DROP POLICY IF EXISTS "Invitees can update their invitations." ON public.room_invitations;
CREATE POLICY "Invitees can update their invitations." ON public.room_invitations
  FOR UPDATE USING (auth.uid() = invitee_id);
DROP POLICY IF EXISTS "Inviters can delete pending invitations." ON public.room_invitations;
CREATE POLICY "Inviters can delete pending invitations." ON public.room_invitations
  FOR DELETE USING (auth.uid() = inviter_id AND status = 'pending');

-- Message Deletions
DROP POLICY IF EXISTS "Users can delete their messages" ON public.message_deletions;
CREATE POLICY "Users can delete their messages" ON public.message_deletions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can view their own message deletions" ON public.message_deletions;
CREATE POLICY "Users can view their own message deletions" ON public.message_deletions
  FOR SELECT TO authenticated USING (user_id = auth.uid());


-- ============================================
-- 8. STORAGE SETUP (chat-files & avatars)
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-files',
  'chat-files',
  false,
  26214400, -- 25MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'video/mp4', 'audio/mpeg', 'application/zip', 'application/x-zip-compressed']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS — chat-files
DROP POLICY IF EXISTS "Users can upload chat files" ON storage.objects;
CREATE POLICY "Users can upload chat files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'chat-files' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );
DROP POLICY IF EXISTS "Users can view chat files" ON storage.objects;
CREATE POLICY "Users can view chat files" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'chat-files');
DROP POLICY IF EXISTS "Users can delete own chat files" ON storage.objects;
CREATE POLICY "Users can delete own chat files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'chat-files' AND owner = auth.uid());

-- Storage RLS — avatars
DROP POLICY IF EXISTS "avatar_public_read" ON storage.objects;
DROP POLICY IF EXISTS "avatar_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatar_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "avatar_auth_delete" ON storage.objects;

CREATE POLICY "avatar_public_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'avatars');
CREATE POLICY "avatar_auth_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "avatar_auth_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "avatar_auth_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'avatars');

-- ============================================
-- 9. REALTIME ENABLEMENT
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friends;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_invitations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_deletions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_deletions;

-- ============================================
-- 10. DEFAULT ROOM & AUTO-ENROLLMENT
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.rooms WHERE id = '00000000-0000-0000-0000-000000000000') THEN
        INSERT INTO public.rooms (id, name, type, created_at)
        VALUES ('00000000-0000-0000-0000-000000000000', 'Genel', 'private', now());
    END IF;
END $$;

-- Add existing users to General Room (idempotent)
INSERT INTO public.room_members (room_id, user_id)
SELECT '00000000-0000-0000-0000-000000000000', id FROM public.users
ON CONFLICT DO NOTHING;

COMMIT;
