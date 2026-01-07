-- ============================================
-- 💬 CHAT APP - COMPLETE SUPABASE SCHEMA (v2.0)
-- ============================================
-- Bu dosya, uygulamanın çalışması için gereken tüm veritabanı yapısını içerir.
-- Supabase SQL Editor üzerinden tek seferde çalıştırabilirsiniz.
-- ============================================

BEGIN;

-- 1. REALTIME PUBLICATION SETUP
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime;

-- ============================================
-- 2. CORE TABLES
-- ============================================

-- Users table (synced with auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  username TEXT UNIQUE,
  email TEXT, -- Email (RLS ile korunur)
  avatar_url TEXT,
  user_code INTEGER UNIQUE, -- 7-digit unique code
  updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Rooms table
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('private', 'dm')) DEFAULT 'private',
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
  message_type TEXT DEFAULT 'text', -- 'text', 'image', 'file'
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
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON public.friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user_room ON public.room_members(user_id, room_id);
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages(room_id);

-- ============================================
-- 4. FUNCTIONS
-- ============================================

-- Generate 7-digit user code
CREATE OR REPLACE FUNCTION generate_user_code()
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
$$ LANGUAGE plpgsql;

-- Handle new user signup (Trigger function)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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

-- Handle friend request accepted
CREATE OR REPLACE FUNCTION handle_friend_request_accepted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    NEW.responded_at = timezone('utc'::text, now());
    INSERT INTO public.friends (user_id, friend_id) VALUES (NEW.sender_id, NEW.receiver_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.friends (user_id, friend_id) VALUES (NEW.receiver_id, NEW.sender_id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Handle room invitation accepted
CREATE OR REPLACE FUNCTION public.handle_invitation_accepted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    NEW.responded_at = timezone('utc'::text, now());
    INSERT INTO public.room_members (room_id, user_id) VALUES (NEW.room_id, NEW.invitee_id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add creator as member
CREATE OR REPLACE FUNCTION public.auto_add_room_creator_as_member()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'private' THEN
    INSERT INTO public.room_members (room_id, user_id) VALUES (NEW.id, NEW.created_by) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Send friend request by code
CREATE OR REPLACE FUNCTION send_friend_request_by_code(target_code INTEGER)
RETURNS JSON AS $$
DECLARE
  target_user_id UUID;
BEGIN
  SELECT id INTO target_user_id FROM public.users WHERE user_code = target_code LIMIT 1;
  IF target_user_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'User not found'); END IF;
  IF target_user_id = auth.uid() THEN RETURN json_build_object('success', false, 'error', 'Cannot add yourself'); END IF;
  
  INSERT INTO public.friend_requests (sender_id, receiver_id, status)
  VALUES (auth.uid(), target_user_id, 'pending');
  
  RETURN json_build_object('success', true, 'message', 'Friend request sent');
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('success', false, 'error', 'Request already sent');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_friend_request_response ON public.friend_requests;
CREATE TRIGGER on_friend_request_response BEFORE UPDATE ON public.friend_requests FOR EACH ROW EXECUTE FUNCTION handle_friend_request_accepted();

DROP TRIGGER IF EXISTS on_invitation_response ON public.room_invitations;
CREATE TRIGGER on_invitation_response BEFORE UPDATE ON public.room_invitations FOR EACH ROW EXECUTE FUNCTION public.handle_invitation_accepted();

DROP TRIGGER IF EXISTS on_room_created_add_creator ON public.rooms;
CREATE TRIGGER on_room_created_add_creator AFTER INSERT ON public.rooms FOR EACH ROW WHEN (NEW.type = 'private') EXECUTE FUNCTION public.auto_add_room_creator_as_member();

-- ============================================
-- 6. RLS POLICIES (Simplified)
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_invitations ENABLE ROW LEVEL SECURITY;

-- Users
CREATE POLICY "Public profiles are viewable by everyone" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Messages
CREATE POLICY "Users can view messages in their rooms" ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.room_members WHERE room_id = messages.room_id AND user_id = auth.uid())
);
CREATE POLICY "Users can insert messages in their rooms" ON public.messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.room_members WHERE room_id = messages.room_id AND user_id = auth.uid())
);
CREATE POLICY "Users can delete own messages" ON public.messages FOR DELETE USING (auth.uid() = user_id);

-- Rooms
CREATE POLICY "Members see private rooms" ON public.rooms FOR SELECT USING (
  id IN (SELECT room_id FROM public.room_members WHERE user_id = auth.uid())
);
CREATE POLICY "Auth users create rooms" ON public.rooms FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Room Members
CREATE POLICY "View members" ON public.room_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.room_members rm WHERE rm.room_id = room_members.room_id AND rm.user_id = auth.uid())
);
CREATE POLICY "Self join" ON public.room_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 7. REALTIME ENABLEMENT
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friends;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_invitations;

COMMIT;
