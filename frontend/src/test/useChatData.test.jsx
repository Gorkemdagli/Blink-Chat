import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useChatData } from '../hooks/useChatData'
import { supabase } from '../supabaseClient'

// Helper to create a chainable mock builder
const createMockBuilder = (name = 'generic') => {
    const builder = {
        select: vi.fn(),
        eq: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(),
        maybeSingle: vi.fn(),
        in: vi.fn(),
        neq: vi.fn(),
        lt: vi.fn(),
        single: vi.fn(),
        // The terminator that executes the query
        then: vi.fn((resolve, reject) => resolve({ data: [], error: null })),
        _name: name
    }

    // Make methods chainable
    builder.select.mockReturnValue(builder)
    builder.eq.mockReturnValue(builder)
    builder.order.mockReturnValue(builder)
    builder.limit.mockReturnValue(builder)
    builder.maybeSingle.mockReturnValue(builder)
    builder.in.mockReturnValue(builder)
    builder.neq.mockReturnValue(builder)
    builder.lt.mockReturnValue(builder)
    builder.single.mockReturnValue(builder)

    return builder
}

describe('useChatData Hook (ULTRATHINK Tests)', () => {
    let mockState
    let mockSession

    // Builders for specific tables
    let usersBuilder
    let messagesBuilder
    let messageDeletionsBuilder
    let roomDeletionsBuilder
    let roomsBuilder
    let membersBuilder

    beforeEach(() => {
        vi.clearAllMocks()

        // Initialize builders
        usersBuilder = createMockBuilder('users')
        messagesBuilder = createMockBuilder('messages')
        messageDeletionsBuilder = createMockBuilder('message_deletions')
        roomDeletionsBuilder = createMockBuilder('room_deletions')
        roomsBuilder = createMockBuilder('rooms')
        membersBuilder = createMockBuilder('members')

        // Override supabase.from implementation
        supabase.from.mockImplementation((table) => {
            switch (table) {
                case 'users': return usersBuilder
                case 'messages': return messagesBuilder
                case 'message_deletions': return messageDeletionsBuilder
                case 'room_deletions': return roomDeletionsBuilder
                case 'rooms': return roomsBuilder
                case 'room_members': return membersBuilder
                default: return createMockBuilder('default')
            }
        })

        // Mock RPC
        supabase.rpc = vi.fn().mockResolvedValue({ data: null, error: null })

        // Mock Session
        mockSession = {
            user: { id: 'test-user-id' }
        }

        // Mock State setters
        mockState = {
            setRooms: vi.fn(),
            setUsers: vi.fn(),
            setCurrentUser: vi.fn(),
            setFriends: vi.fn(),
            setFriendRequests: vi.fn(),
            setMessages: vi.fn(),
            setLastMessages: vi.fn(),
            setUnreadCounts: vi.fn(),
            setPendingInvitations: vi.fn(),
            setIsLoadingRooms: vi.fn(),
            setIsLoadingMessages: vi.fn(),
            setIsLoadingMoreMessages: vi.fn(),
            setHasMoreMessages: vi.fn(),
            setOldestMessageId: vi.fn(),
            currentRoom: null,
            oldestMessageId: null,
            hasMoreMessages: false,
            isLoadingMoreMessages: false,
            userCacheRef: { current: new Map() },
            fetchRoomsTimeoutRef: { current: null },
            cacheUsers: vi.fn((users) => {
                if (!users) return
                users.forEach(u => mockState.userCacheRef.current.set(u.id, u))
            }),
            MESSAGE_LIMIT: 20
        }

        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: vi.fn(() => null),
                setItem: vi.fn(),
                clear: vi.fn()
            },
            configurable: true,
            writable: true
        })

        // Suppress console.error
        vi.spyOn(console, 'error').mockImplementation(() => { })
    })

    it('should handle fetchRooms with error gracefully (Error Handling)', async () => {
        // Arrange: Mock failure for RPC query
        supabase.rpc.mockResolvedValueOnce({ data: null, error: new Error('Network Error') })

        const { result } = renderHook(() => useChatData(mockSession, mockState))

        // Act
        await result.current.fetchRooms()

        // Assert
        expect(mockState.setIsLoadingRooms).toHaveBeenCalledWith(true)
        // Should catch error and reset loading
        expect(mockState.setRooms).toHaveBeenCalledWith([])
        expect(mockState.setIsLoadingRooms).toHaveBeenCalledWith(false)
    })

    it('should successfully fetch into state using RPC (Network Consolidation)', async () => {
        // Arrange
        const mockInitData = {
            current_user: { id: 'test-user-id', username: 'me' },
            rooms: [
                { id: 'room-1', name: 'General', type: 'private', members: [{ user_id: 'test-user-id' }, { user_id: 'other-id', username: 'other', avatar_url: 'url' }] }
            ],
            friends: [{ friend_id: 'friend-1', username: 'Friend' }],
            last_messages: [
                { id: 'msg-1', room_id: 'room-1', content: 'hello', user_id: 'other-id', created_at: '2023-01-01T12:00:00Z', username: 'other', avatar_url: 'url' }
            ]
        }
        supabase.rpc.mockResolvedValueOnce({ data: mockInitData, error: null })

        const { result } = renderHook(() => useChatData(mockSession, mockState))

        // Act
        await result.current.fetchRooms()

        // Assert
        expect(supabase.rpc).toHaveBeenCalledWith('get_chat_init_data')
        expect(mockState.setCurrentUser).toHaveBeenCalledWith(mockInitData.current_user)
        expect(mockState.setRooms).toHaveBeenCalled()
        expect(mockState.setLastMessages).toHaveBeenCalled()
        expect(mockState.setFriends).toHaveBeenCalledWith(mockInitData.friends)
    })

    it('should deduplicate messages when fetching (Data Integrity)', async () => {
        // Arrange
        const mockMessages = [
            { id: 1, content: 'Hi', user_id: 'u1', created_at: '2023-01-01' },
            { id: 1, content: 'Hi', user_id: 'u1', created_at: '2023-01-01' } // Duplicate
        ]

        messagesBuilder.then.mockImplementation((resolve) => resolve({ data: mockMessages, error: null }))
        messageDeletionsBuilder.then.mockImplementation((resolve) => resolve({ data: [], error: null }))

        // Mock user cache hit
        mockState.userCacheRef.current.set('u1', { id: 'u1', username: 'TestUser' })

        const { result } = renderHook(() => useChatData(mockSession, mockState))

        // Act
        await result.current.fetchMessages('room-1')

        // Assert
        expect(mockState.setMessages).toHaveBeenCalled()
        // First call is empty array (loading state), second call is data
        const lastCall = mockState.setMessages.mock.lastCall[0]

        expect(lastCall).toHaveLength(1)
        expect(lastCall[0].id).toBe(1)
    })

    it('should use cache for getUserData and strictly avoid redundant fetches (Caching Strategy)', async () => {
        const userId = 'cached-user-id'
        const userData = { id: userId, username: 'CachedUser' }
        mockState.userCacheRef.current.set(userId, userData)

        const { result } = renderHook(() => useChatData(mockSession, mockState))
        const data = await result.current.getUserData(userId)

        expect(data).toEqual(userData)
        expect(usersBuilder.select).not.toHaveBeenCalled()
    })

    it('should fetch user from DB if not in cache (Caching Strategy)', async () => {
        const userId = 'new-user-id'
        const dbUser = { id: userId, username: 'NewUser' }

        usersBuilder.then.mockImplementation((resolve) => resolve({ data: dbUser, error: null }))

        const { result } = renderHook(() => useChatData(mockSession, mockState))
        const data = await result.current.getUserData(userId)

        expect(data).toEqual(dbUser)
        expect(usersBuilder.select).toHaveBeenCalled()
        expect(mockState.userCacheRef.current.get(userId)).toEqual(dbUser)
    })

    it('should execute debouncedFetchRooms only once after multiple rapid calls (Concurrency/Debounce)', async () => {
        vi.useFakeTimers()

        const { result } = renderHook(() => useChatData(mockSession, mockState))

        result.current.debouncedFetchRooms()
        result.current.debouncedFetchRooms()
        result.current.debouncedFetchRooms()

        vi.runAllTimers()

        expect(mockState.setIsLoadingRooms).toHaveBeenCalledTimes(1)
        vi.useRealTimers()
    })
})
