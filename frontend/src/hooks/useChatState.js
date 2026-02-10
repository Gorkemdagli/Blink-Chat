import { useState, useRef, useCallback } from 'react'

/**
 * Chat state yönetimi için custom hook
 * Tüm state'leri ve temel utility fonksiyonlarını içerir
 */
export function useChatState() {
    // Core State
    const [rooms, setRooms] = useState([])
    const [users, setUsers] = useState([])
    const [currentRoom, setCurrentRoom] = useState(null)
    const [messages, setMessages] = useState([])
    const [newMessage, setNewMessage] = useState('')
    const [activeTab, setActiveTab] = useState('rooms')

    // Loading States
    const [isLoadingRooms, setIsLoadingRooms] = useState(false)
    const [isLoadingMessages, setIsLoadingMessages] = useState(false)
    const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false)

    // Unread & Last Messages
    const [unreadCounts, setUnreadCounts] = useState({})
    const [lastMessages, setLastMessages] = useState({})

    // Pagination
    const [hasMoreMessages, setHasMoreMessages] = useState(false)
    const [oldestMessageId, setOldestMessageId] = useState(null)
    const MESSAGE_LIMIT = 50

    // User Data
    const [currentUser, setCurrentUser] = useState(null)
    const [friends, setFriends] = useState([])
    const [friendRequests, setFriendRequests] = useState([])

    // Presence
    const [onlineUsers, setOnlineUsers] = useState(new Set())
    const [userPresence, setUserPresence] = useState(new Map())

    // Modals & UI
    const [showInviteModal, setShowInviteModal] = useState(false)
    const [showInvitationsPanel, setShowInvitationsPanel] = useState(false)
    const [showAddFriendModal, setShowAddFriendModal] = useState(false)
    const [showCreateRoomModal, setShowCreateRoomModal] = useState(false)
    const [pendingInvitations, setPendingInvitations] = useState([])
    const [friendCode, setFriendCode] = useState('')
    const [newRoomName, setNewRoomName] = useState('')
    const [selectedFriendsForRoom, setSelectedFriendsForRoom] = useState([])
    const [view, setView] = useState('sidebar') // 'sidebar' | 'chat'

    // Toast
    const [toast, setToast] = useState(null)

    // Refs
    const currentRoomRef = useRef(null)
    const presenceSubscribedRef = useRef(false)
    const userCacheRef = useRef(new Map())
    const fetchRoomsTimeoutRef = useRef(null)

    // Toast helper
    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }, [])

    // User cache helpers
    const getUserFromCache = useCallback((userId) => {
        return userCacheRef.current.get(userId)
    }, [])

    const setUserToCache = useCallback((userId, userData) => {
        userCacheRef.current.set(userId, userData)
    }, [])

    const cacheUsers = useCallback((usersData) => {
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
        toast, showToast,

        // Refs
        currentRoomRef,
        presenceSubscribedRef,
        userCacheRef,
        fetchRoomsTimeoutRef,

        // Cache helpers
        getUserFromCache,
        setUserToCache,
        cacheUsers
    }
}

export default useChatState
