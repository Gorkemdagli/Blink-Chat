export interface User {
    id: string
    username: string
    email?: string
    avatar_url?: string
    status?: string
    online?: boolean
    last_seen?: string
    user_code?: string
    bio?: string
}

export interface Friend extends User {
    friend_id?: string
    friend_username?: string
    friend_email?: string
    friend_avatar?: string
}

export interface Room {
    id: string
    name?: string
    type: 'dm' | 'private' | 'public'
    avatar_url?: string
    created_at?: string
    created_by?: string
    isOwner?: boolean
    otherUser?: User
    lastMessage?: Message
    unreadCount?: number
    members?: string[] // Array of user IDs
    isMember?: boolean
    is_provisional?: boolean
}

export interface Message {
    id: string
    content: string
    user_id: string
    room_id: string
    created_at: string
    user?: User
    file_url?: string | null
    message_type?: 'text' | 'image' | 'video' | 'file' | 'system'
    file_name?: string
    file_size?: number
    status?: 'sent' | 'delivered' | 'read'
    sender?: string
}

export interface FriendRequest {
    id: string
    sender_id: string
    receiver_id: string
    status: 'pending' | 'accepted' | 'rejected'
    created_at: string
    sender?: User
    receiver?: User
    // Fields from join
    sender_username?: string
    sender_email?: string
    sender_avatar?: string
}

export interface Toast {
    message: string
    type: 'success' | 'error' | 'info' | 'warning'
}

export interface UnreadCounts {
    [roomId: string]: number
}

export interface UserPresence {
    [userId: string]: {
        online: boolean
        lastSeen: string
    }
}

export interface RoomInvite {
    id: string
    room_id: string
    inviter_id: string
    invitee_id: string
    status: string
    created_at: string
    room_name?: string
    inviter_username?: string
    inviter_email?: string
}
