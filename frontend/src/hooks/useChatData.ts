import { useCallback } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'
import { User, Room, Message, UnreadCounts } from '../types'
import { useChatState } from './useChatState'

type ChatState = ReturnType<typeof useChatState>

/**
 * Chat data fetching fonksiyonları için custom hook
 * OPTIMIZED: N+1 queries eliminated, duplicate queries removed, waterfall flattened
 */
export function useChatData(session: Session, state: ChatState) {
    const {
        setRooms, setUsers, setCurrentUser, setFriends, setFriendRequests,
        setMessages, setLastMessages, setUnreadCounts, setPendingInvitations,
        setIsLoadingRooms, setIsLoadingMessages, setIsLoadingMoreMessages,
        setHasMoreMessages, setOldestMessageId, setOldestMessageDate,
        currentRoom, oldestMessageId, oldestMessageDate, hasMoreMessages, isLoadingMoreMessages,
        userCacheRef, deletedMessageIdsRef, fetchRoomsTimeoutRef,
        cacheUsers, MESSAGE_LIMIT
    } = state

    // Kullanıcı bilgisini cache'den al veya fetch et
    const getUserData = useCallback(async (userId: string) => {
        if (userCacheRef.current.has(userId)) {
            return userCacheRef.current.get(userId)
        }

        const { data, error } = await supabase
            .from('users')
            .select('id, username, email, user_code, avatar_url')
            .eq('id', userId)
            .maybeSingle()

        if (error) {
            console.error('Error fetching user data:', error)
            return null
        }

        if (data) {
            userCacheRef.current.set(userId, data)
        }

        return data
    }, [userCacheRef])

    // Kendi kullanıcı bilgilerimizi çek
    const fetchCurrentUser = useCallback(async () => {
        const { data, error } = await supabase
            .from('users')
            .select('id, username, email, user_code, avatar_url')
            .eq('id', session.user.id)
            .single()

        if (error) {
            console.error('Error fetching current user:', error)
        } else {
            setCurrentUser(data)
        }
    }, [session.user.id, setCurrentUser])

    // Arkadaşları getir
    const fetchFriends = useCallback(async () => {
        const { data, error } = await supabase
            .from('friends_with_details')
            .select('*')
            .eq('user_id', session.user.id)

        if (error) {
            console.error('Error fetching friends:', error)
        } else {
            setFriends(data || [])
        }
    }, [session.user.id, setFriends])

    // Bekleyen friend requests
    const fetchFriendRequests = useCallback(async () => {
        const { data, error } = await supabase
            .from('pending_friend_requests_with_details')
            .select('*')
            .eq('receiver_id', session.user.id)

        if (error) {
            console.error('Error fetching friend requests:', error)
        } else {
            setFriendRequests(data || [])
        }
    }, [session.user.id, setFriendRequests])

    // Kullanıcıları getir
    const fetchUsers = useCallback(async () => {
        const { data, error } = await supabase
            .from('users')
            .select('id, username, email, user_code, avatar_url, created_at')
            .neq('id', session.user.id)

        if (error) {
            console.error('Error fetching users:', error)
        } else {
            cacheUsers(data)
            setUsers(data || [])
        }
    }, [session.user.id, setUsers, cacheUsers])

    // Davetleri getir
    const fetchPendingInvitations = useCallback(async () => {
        const { data, error } = await supabase
            .from('pending_invitations_with_details')
            .select('*')
            .eq('invitee_id', session.user.id)

        if (error) {
            console.error('Error fetching invitations:', error)
        } else {
            setPendingInvitations(data || [])
        }
    }, [session.user.id, setPendingInvitations])

    // OPTIMIZED: Tüm social verileri TEK batch'te çek (auth context overhead azaltma)
    const fetchSocialData = useCallback(async () => {
        const [
            { data: friendsData, error: friendsErr },
            { data: requestsData, error: requestsErr },
            { data: invitationsData, error: invitationsErr }
        ] = await Promise.all([
            // @ts-ignore - Supabase types might imply specific table names
            supabase.from('friends_with_details').select('*').eq('user_id', session.user.id),
            supabase.from('pending_friend_requests_with_details').select('*').eq('receiver_id', session.user.id),
            supabase.from('pending_invitations_with_details').select('*').eq('invitee_id', session.user.id)
        ])

        if (!friendsErr) setFriends(friendsData || [])
        if (!requestsErr) setFriendRequests(requestsData || [])
        if (!invitationsErr) setPendingInvitations(invitationsData || [])
    }, [session.user.id, setFriends, setFriendRequests, setPendingInvitations])

    // OPTIMIZED: Son mesajları tek sorguda getir (N+1 eliminasyonu)
    const fetchLastMessages = useCallback(async (roomIds: string[], deletedMessageIds = new Set<string>()) => {
        if (!roomIds || roomIds.length === 0) {
            setLastMessages({})
            return
        }

        try {
            // SINGLE QUERY: Tüm odaların mesajlarını tek seferde çek
            const { data: allMessages, error } = await supabase
                .from('messages')
                .select('id, content, message_type, user_id, created_at, room_id')
                .in('room_id', roomIds)
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Error fetching last messages:', error)
                return
            }

            // Her oda için son mesajı bul (JS'de deduplicate)
            const lastMessagesObj: { [key: string]: Message } = {}
            const userIdsToFetch = new Set<string>()
            const seenRooms = new Set<string>()

            for (const msg of allMessages || []) {
                // Bu oda için zaten mesaj ekledik mi?
                if (seenRooms.has(msg.room_id)) continue
                // Silinen mesajları atla
                if (deletedMessageIds.has(msg.id)) continue

                seenRooms.add(msg.room_id)
                userIdsToFetch.add(msg.user_id)
                lastMessagesObj[msg.room_id] = msg
            }

            // Batch fetch missing users
            const uniqueUserIds = [...userIdsToFetch]
            const uncachedUserIds = uniqueUserIds.filter(id => !userCacheRef.current.has(id))

            if (uncachedUserIds.length > 0) {
                const { data: usersData } = await supabase
                    .from('users')
                    .select('id, username, email, user_code, avatar_url')
                    .in('id', uncachedUserIds)

                if (usersData) {
                    cacheUsers(usersData)
                }
            }

            // User data ekle
            Object.keys(lastMessagesObj).forEach(roomId => {
                const msg = lastMessagesObj[roomId]
                const userData = userCacheRef.current.get(msg.user_id)
                lastMessagesObj[roomId] = { ...msg, user: userData }
            })

            setLastMessages(lastMessagesObj)
        } catch (error) {
            console.error('Error fetching last messages:', error)
        }
    }, [setLastMessages, cacheUsers, userCacheRef])

    // OPTIMIZED: Okunmamış mesaj sayılarını getir (roomIds parametre olarak alıyor)
    const fetchUnreadCounts = useCallback(async (roomIds: string[], allMessages: { room_id: string, created_at: string, user_id: string }[] | null = null) => {
        if (!roomIds || roomIds.length === 0) {
            setUnreadCounts({})
            return
        }

        try {
            // Eğer mesajlar zaten verilmişse tekrar çekme
            let messagesToUse = allMessages
            if (!messagesToUse) {
                const { data, error } = await supabase
                    .from('messages')
                    .select('id, created_at, user_id, room_id')
                    .in('room_id', roomIds)
                    .neq('user_id', session.user.id)
                    .order('created_at', { ascending: false })

                if (error) {
                    console.error('❌ messages fetch error:', error)
                    return
                }
                messagesToUse = data
            }

            const countsObj: { [key: string]: number } = {}

            roomIds.forEach(roomId => {
                const lastOpenKey = `lastOpen_${roomId}`
                const lastOpen = localStorage.getItem(lastOpenKey)
                const roomMessages = messagesToUse?.filter((m: { room_id: string, created_at: string, user_id: string }) => m.room_id === roomId) || []

                if (!lastOpen) {
                    if (roomMessages.length > 0) {
                        const lastMessage = roomMessages[0]
                        localStorage.setItem(lastOpenKey, lastMessage.created_at)
                        countsObj[roomId] = 0
                    } else {
                        countsObj[roomId] = 0
                    }
                } else {
                    const lastOpenDate = new Date(lastOpen)
                    const count = roomMessages.filter((m: { room_id: string, created_at: string, user_id: string }) =>
                        new Date(m.created_at) > lastOpenDate
                    ).length || 0
                    countsObj[roomId] = count
                }
            })

            setUnreadCounts(countsObj)
        } catch (error) {
            console.error('Error fetching unread counts:', error)
        }
    }, [session.user.id, setUnreadCounts])

    // OPTIMIZED: Odaları ve tüm başlangıç verilerini getir - Single RPC call
    const fetchRooms = useCallback(async () => {
        setIsLoadingRooms(true)
        try {
            // SINGLE RPC CALL: Tüm verileri tek seferde çek (Network waterfall elimination)
            const { data: initData, error: rpcError } = await supabase.rpc('get_chat_init_data') as any

            if (rpcError) {
                console.error('Error fetching init data via RPC:', rpcError)
                setRooms([])
                setIsLoadingRooms(false)
                return
            }

            if (!initData) {
                setRooms([])
                setIsLoadingRooms(false)
                return
            }

            // 1. Current User
            if (initData.current_user) {
                setCurrentUser(initData.current_user)
                userCacheRef.current.set(initData.current_user.id, initData.current_user)
            }

            // 2. Social Data
            setFriends(initData.friends || [])
            setFriendRequests(initData.friend_requests || [])
            setPendingInvitations(initData.invitations || [])

            // 3. Deletions
            const deletedRoomIds = new Set<string>(initData.room_deletions || [])
            const deletedMessageIds = new Set<string>(initData.message_deletions || [])

            // Sync with ref for other functions to use
            if (deletedMessageIdsRef.current) {
                deletedMessageIdsRef.current = deletedMessageIds
            }

            // 4. Rooms & Cache Preparation
            const allRooms: Room[] = []
            const userMap = userCacheRef.current

            // Toplu cacheleme (members ve last_messages'dan gelen kullanıcılar)
            if (initData.rooms) {
                initData.rooms.forEach((room: Omit<Room, 'members'> & { members?: any[] }) => {
                    if (room.members) {
                        room.members.forEach(m => {
                            if (!userMap.has(m.user_id)) {
                                userMap.set(m.user_id, {
                                    id: m.user_id,
                                    username: m.username,
                                    avatar_url: m.avatar_url
                                } as User)
                            }
                        })
                    }
                })
            }

            if (initData.last_messages) {
                initData.last_messages.forEach((msg: Message) => {
                    if (!userMap.has(msg.user_id)) {
                        userMap.set(msg.user_id, {
                            id: msg.user_id,
                            username: msg.user?.username || '',
                            avatar_url: msg.user?.avatar_url || ''
                        } as User)
                    }
                })
            }

            // visibleRooms build
            (initData.rooms || []).forEach((room: Omit<Room, 'members'> & { members?: any[] }) => {
                if (deletedRoomIds.has(room.id)) return

                if (room.type === 'private') {
                    allRooms.push({
                        ...(room as unknown as Room),
                        isMember: true,
                        isOwner: room.created_by === session.user.id
                    })
                } else if (room.type === 'dm') {
                    const otherMember = room.members?.find((m) => m.user_id !== session.user.id)
                    allRooms.push({
                        ...(room as unknown as Room),
                        otherUser: otherMember ? userMap.get(otherMember.user_id) : undefined,
                        isMember: true
                    })
                }
            })

            setRooms(allRooms)

            // 5. Last Messages
            const lastMessagesObj: { [key: string]: Message } = {}
            if (initData.last_messages) {
                initData.last_messages.forEach((msg: Message) => {
                    if (deletedMessageIds.has(msg.id)) return
                    lastMessagesObj[msg.room_id] = {
                        ...msg,
                        user: userMap.get(msg.user_id)
                    }
                })
            }
            setLastMessages(lastMessagesObj)

            // 6. Unread Counts (Simple heuristic based on last messages)
            const countsObj: UnreadCounts = {}
            allRooms.forEach(room => {
                const roomId = room.id
                const lastOpenKey = `lastOpen_${roomId}`
                const lastOpen = localStorage.getItem(lastOpenKey)
                const lastMsg = lastMessagesObj[roomId]

                if (!lastOpen || !lastMsg) {
                    countsObj[roomId] = 0
                } else if (lastMsg.user_id !== session.user.id) {
                    const lastOpenDate = new Date(lastOpen)
                    const msgDate = new Date(lastMsg.created_at)
                    countsObj[roomId] = msgDate > lastOpenDate ? 1 : 0
                } else {
                    countsObj[roomId] = 0
                }
            })
            setUnreadCounts(countsObj)

        } catch (error) {
            console.error('Critical error in fetchRooms (RPC):', error)
            setRooms([])
        } finally {
            setIsLoadingRooms(false)
        }
    }, [session.user.id, setRooms, setIsLoadingRooms, setLastMessages, setUnreadCounts, setFriends, setFriendRequests, setPendingInvitations, setCurrentUser, userCacheRef])

    // Debounced fetchRooms
    const debouncedFetchRooms = useCallback(() => {
        if (fetchRoomsTimeoutRef.current) {
            clearTimeout(fetchRoomsTimeoutRef.current)
        }
        fetchRoomsTimeoutRef.current = setTimeout(() => {
            fetchRooms()
        }, 500)
    }, [fetchRooms, fetchRoomsTimeoutRef])

    // Mesajları getir
    const fetchMessages = useCallback(async (roomId: string, isInitial = true) => {
        if (isInitial) {
            setIsLoadingMessages(true)
            setMessages([])
            setOldestMessageId(null)
            setHasMoreMessages(false)
        }

        if (roomId.startsWith('temp-')) {
            setIsLoadingMessages(false)
            return
        }

        try {
            // OPTIMIZED: Use RPC to bypass RLS overhead
            const { data, error } = await supabase.rpc('get_chat_messages', {
                p_room_id: roomId,
                p_limit: MESSAGE_LIMIT + 1
            })

            if (error) {
                console.error('Error fetching messages (RPC):', error)
                return
            }

            const hasMore = data && data.length > MESSAGE_LIMIT
            setHasMoreMessages(hasMore)

            const messagesToShow = hasMore ? data.slice(0, MESSAGE_LIMIT) : data || []

            if (messagesToShow.length > 0) {
                setOldestMessageId(messagesToShow[messagesToShow.length - 1].id)
                setOldestMessageDate(messagesToShow[messagesToShow.length - 1].created_at)
            }

            const deletedMessageIds = deletedMessageIdsRef.current
            const visibleMessages = messagesToShow.filter((msg: any) => !deletedMessageIds.has(msg.id))

            const userIds = [...new Set(visibleMessages.map((m: any) => m.user_id))] as string[]

            if (userIds.length === 0) {
                setMessages([])
                return
            }

            const uncachedUserIds = userIds.filter(id => !userCacheRef.current.has(id))

            if (uncachedUserIds.length > 0) {
                const { data: usersData } = await supabase
                    .from('users')
                    .select('id, username, email, user_code, avatar_url')
                    .in('id', uncachedUserIds)

                if (usersData) {
                    cacheUsers(usersData)
                }
            }

            const messagesWithUsers = visibleMessages.map((msg: any) => ({
                ...msg,
                user: userCacheRef.current.get(msg.user_id)
            }))

            const sortedMessages = messagesWithUsers.reverse()
            const uniqueMessages: Message[] = []
            const seenIds = new Set()
            for (const msg of sortedMessages) {
                if (!seenIds.has(msg.id)) {
                    seenIds.add(msg.id)
                    uniqueMessages.push(msg)
                }
            }
            setMessages(uniqueMessages)

            if (uniqueMessages.length > 0 && currentRoom) {
                const lastMessage = uniqueMessages[uniqueMessages.length - 1]
                const lastOpenKey = `lastOpen_${currentRoom.id}`
                localStorage.setItem(lastOpenKey, lastMessage.created_at)
                setUnreadCounts((prev: UnreadCounts) => ({ ...prev, [currentRoom.id]: 0 }))
            }
        } catch (error) {
            console.error('Error in fetchMessages:', error)
            setMessages([])
        } finally {
            setIsLoadingMessages(false)
        }
    }, [session.user.id, setMessages, setIsLoadingMessages, setHasMoreMessages, setOldestMessageId, setUnreadCounts, cacheUsers, userCacheRef, MESSAGE_LIMIT, currentRoom])

    // Eski mesajları yükle
    const loadMoreMessages = useCallback(async () => {
        if (!currentRoom || !oldestMessageId || isLoadingMoreMessages || !hasMoreMessages || currentRoom.is_provisional) {
            return Promise.resolve()
        }

        setIsLoadingMoreMessages(true)

        try {
            // OPTIMIZED: Use RPC with timestamp pagination
            const { data, error } = await supabase.rpc('get_chat_messages', {
                p_room_id: currentRoom.id,
                p_limit: MESSAGE_LIMIT + 1,
                p_before_created_at: oldestMessageDate
            })

            if (error) {
                console.error('Error loading more messages (RPC):', error)
                return
            }

            if (!data || data.length === 0) {
                setHasMoreMessages(false)
                return
            }

            const hasMore = data.length > MESSAGE_LIMIT
            setHasMoreMessages(hasMore)

            const messagesToShow = hasMore ? data.slice(0, MESSAGE_LIMIT) : data

            if (messagesToShow.length > 0) {
                setOldestMessageId(messagesToShow[messagesToShow.length - 1].id)
                setOldestMessageDate(messagesToShow[messagesToShow.length - 1].created_at)
            }

            const deletedMessageIds = deletedMessageIdsRef.current
            const visibleMessages = messagesToShow.filter((msg: any) => !deletedMessageIds.has(msg.id))

            const userIds = [...new Set(visibleMessages.map((m: any) => m.user_id))] as string[]
            const uncachedUserIds = userIds.filter(id => !userCacheRef.current.has(id))

            if (uncachedUserIds.length > 0) {
                const { data: usersData } = await supabase
                    .from('users')
                    .select('id, username, email, user_code, avatar_url')
                    .in('id', uncachedUserIds)

                if (usersData) {
                    cacheUsers(usersData)
                }
            }

            const messagesWithUsers = visibleMessages.map((msg: any) => ({
                ...msg,
                user: userCacheRef.current.get(msg.user_id)
            }))

            const sortedNewMessages = messagesWithUsers.reverse()
            setMessages((prevMessages: Message[]) => {
                const combined = [...sortedNewMessages, ...prevMessages]
                const uniqueMessages: Message[] = []
                const seenIds = new Set()
                for (let i = combined.length - 1; i >= 0; i--) {
                    if (!seenIds.has(combined[i].id)) {
                        seenIds.add(combined[i].id)
                        uniqueMessages.unshift(combined[i])
                    }
                }
                return uniqueMessages
            })
        } catch (error) {
            console.error('Error in loadMoreMessages:', error)
        } finally {
            setIsLoadingMoreMessages(false)
        }
    }, [currentRoom, oldestMessageId, isLoadingMoreMessages, hasMoreMessages, session.user.id, setMessages, setIsLoadingMoreMessages, setHasMoreMessages, setOldestMessageId, cacheUsers, userCacheRef, MESSAGE_LIMIT])

    return {
        getUserData,
        fetchCurrentUser,
        fetchFriends,
        fetchFriendRequests,
        fetchUsers,
        fetchPendingInvitations,
        fetchSocialData,
        fetchLastMessages,
        fetchUnreadCounts,
        fetchRooms,
        debouncedFetchRooms,
        fetchMessages,
        loadMoreMessages
    }
}

export default useChatData
