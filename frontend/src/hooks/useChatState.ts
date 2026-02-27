import { useState, useRef, useCallback } from 'react'
import { User, Room, Message, FriendRequest, Toast, UnreadCounts, Friend, RoomInvite } from '../types'

/**
 * Chat state yönetimi için custom hook
 * Tüm state'leri ve temel utility fonksiyonlarını içerir
 */
export function useChatState() {
    // Core State
    const [rooms, setRooms] = useState<Room[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [activeTab, setActiveTab] = useState<'rooms' | 'friends'>('rooms')

    // Loading States
    const [isLoadingRooms, setIsLoadingRooms] = useState(false)
    const [isLoadingMessages, setIsLoadingMessages] = useState(false)
    const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false)

    // Unread & Last Messages
    const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({})
    const [lastMessages, setLastMessages] = useState<{ [roomId: string]: Message }>({})

    // Pagination
    const [hasMoreMessages, setHasMoreMessages] = useState(false)
    const [oldestMessageId, setOldestMessageId] = useState<string | null>(null)
    const [oldestMessageDate, setOldestMessageDate] = useState<string | null>(null)
    const MESSAGE_LIMIT = 50

    // User Data
    const [currentUser, setCurrentUser] = useState<User | null>(null)
    const [friends, setFriends] = useState<Friend[]>([])
    const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([])

    // Presence
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
    const [userPresence, setUserPresence] = useState<Map<string, { online: boolean; lastSeen: string }>>(new Map())

    // Modals & UI
    const [showInviteModal, setShowInviteModal] = useState(false)
    const [showInvitationsPanel, setShowInvitationsPanel] = useState(false)
    const [showAddFriendModal, setShowAddFriendModal] = useState(false)
    const [showCreateRoomModal, setShowCreateRoomModal] = useState(false)
    const [pendingInvitations, setPendingInvitations] = useState<RoomInvite[]>([])
    const [friendCode, setFriendCode] = useState('')
    const [newRoomName, setNewRoomName] = useState('')
    const [selectedFriendsForRoom, setSelectedFriendsForRoom] = useState<string[]>([])
    const [view, setView] = useState<'sidebar' | 'chat'>('sidebar')

    // Toast
    const [toast, setToast] = useState<Toast | null>(null)

    // Refs
    const currentRoomRef = useRef<Room | null>(null)
    const presenceSubscribedRef = useRef(false)
    const userCacheRef = useRef<Map<string, User>>(new Map())
    const deletedMessageIdsRef = useRef<Set<string>>(new Set())
    const fetchRoomsTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Toast helper
    const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }, [])

    const hideToast = useCallback(() => {
        setToast(null)
    }, [])

    // User cache helpers
    const getUserFromCache = useCallback((userId: string) => {
        return userCacheRef.current.get(userId)
    }, [])

    const setUserToCache = useCallback((userId: string, userData: User) => {
        userCacheRef.current.set(userId, userData)
    }, [])

    const cacheUsers = useCallback((usersData: User[]) => {
        usersData?.forEach(user => {
            if (user?.id) {
                userCacheRef.current.set(user.id, user)
            }
        })
    }, [])

    return {
        // Core State
        rooms, setRooms,
        users, setUsers,
        currentRoom, setCurrentRoom,
        messages, setMessages,
        newMessage, setNewMessage,
        activeTab, setActiveTab,

        // Loading States
        isLoadingRooms, setIsLoadingRooms,
        isLoadingMessages, setIsLoadingMessages,
        isLoadingMoreMessages, setIsLoadingMoreMessages,

        // Unread & Last Messages
        unreadCounts, setUnreadCounts,
        lastMessages, setLastMessages,

        // Pagination
        hasMoreMessages, setHasMoreMessages,
        oldestMessageId, setOldestMessageId,
        oldestMessageDate, setOldestMessageDate,
        MESSAGE_LIMIT,

        // User Data
        currentUser, setCurrentUser,
        friends, setFriends,
        friendRequests, setFriendRequests,

        // Presence
        onlineUsers, setOnlineUsers,
        userPresence, setUserPresence,

        // Modals & UI
        showInviteModal, setShowInviteModal,
        showInvitationsPanel, setShowInvitationsPanel,
        showAddFriendModal, setShowAddFriendModal,
        showCreateRoomModal, setShowCreateRoomModal,
        pendingInvitations, setPendingInvitations,
        friendCode, setFriendCode,
        newRoomName, setNewRoomName,
        selectedFriendsForRoom, setSelectedFriendsForRoom,
        view, setView,

        // Toast
        toast, showToast, hideToast,

        // Refs
        currentRoomRef,
        presenceSubscribedRef,
        userCacheRef,
        deletedMessageIdsRef,
        fetchRoomsTimeoutRef,

        // Cache helpers
        getUserFromCache,
        setUserToCache,
        cacheUsers
    }
}

export default useChatState
