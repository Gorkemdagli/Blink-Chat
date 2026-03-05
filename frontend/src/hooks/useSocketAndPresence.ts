import { useEffect } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'
import { getSocket } from '../socket'
import { Room, Message, UnreadCounts, Friend } from '../types'
import useChatState from './useChatState'
import useChatData from './useChatData'

type ChatState = ReturnType<typeof useChatState>
type ChatData = ReturnType<typeof useChatData>

/**
 * Socket.IO ve Supabase Presence yönetimi için custom hook
 */
export function useSocketAndPresence(session: Session, state: ChatState, dataFunctions: ChatData) {
    const {
        currentRoom, setCurrentRoom,
        messages, setMessages,
        setRooms, setUnreadCounts, setLastMessages,
        onlineUsers, setOnlineUsers, setUserPresence,
        setFriends,
        currentRoomRef, presenceSubscribedRef,
    } = state

    const {
        debouncedFetchRooms,
        fetchFriendRequests, fetchFriends,
        fetchPendingInvitations, fetchMessages,
    } = dataFunctions

    // currentRoom ref'ini güncelle
    useEffect(() => {
        currentRoomRef.current = currentRoom
    }, [currentRoom, currentRoomRef])

    // Önceki odadan ayrılırken lastOpen güncelle
    useEffect(() => {
        return () => {
            if (currentRoom && messages.length > 0) {
                const lastMessage = messages[messages.length - 1]
                const lastOpenKey = `lastOpen_${currentRoom.id}`
                localStorage.setItem(lastOpenKey, lastMessage.created_at)
            }
        }
    }, [currentRoom, messages])

    // Ana effect: Socket ve Presence bağlantıları
    useEffect(() => {
        // Global Socket.IO listener
        const socket = getSocket(session.access_token)

        const handleUnifiedNewMessage = (messageWithUser: any) => {
            // 1. Sidebar güncelleme (son mesaj)
            setLastMessages((prev: { [key: string]: Message }) => ({
                ...prev,
                [messageWithUser.room_id]: {
                    id: messageWithUser.id,
                    content: messageWithUser.content,
                    message_type: messageWithUser.message_type,
                    user_id: messageWithUser.user_id,
                    created_at: messageWithUser.created_at,
                    user: messageWithUser.user || messageWithUser.userData,
                    room_id: messageWithUser.room_id
                } as Message
            }))

            const currentRoomId = currentRoomRef.current?.id

            // 2. Aktif oda ise mesaj listesini güncelle
            if (messageWithUser.room_id === currentRoomId) {
                setMessages((prev: Message[]) => {
                    if (prev.some(msg => msg.id === messageWithUser.id)) return prev
                    return [...prev, messageWithUser]
                })
            }

            // 3. Başka bir oda ise ve mesaj benden değilse okunmamış sayısını artır
            if (messageWithUser.user_id !== session.user.id && messageWithUser.room_id !== currentRoomId) {
                setUnreadCounts((prev: UnreadCounts) => ({
                    ...prev,
                    [messageWithUser.room_id]: (prev[messageWithUser.room_id] || 0) + 1
                }))
            }
        }

        socket.on('newMessage', handleUnifiedNewMessage)

        // Okundu bilgisini de global dinliyoruz (tüm cihazlarda sync için veya sidebar için)
        socket.on('messages_read', ({ roomId }: { roomId: string }) => {
            // Eğer aktif oda ise görkemli mavi tikler
            if (roomId === currentRoomRef.current?.id) {
                setMessages((prev: Message[]) => {
                    const hasUnread = prev.some(msg => msg.user_id === session.user.id && msg.status !== 'read')
                    if (!hasUnread) return prev
                    return prev.map(msg => (msg.user_id === session.user.id && msg.status !== 'read') ? { ...msg, status: 'read' } : msg)
                })
            }
        })

        // Realtime channels için referanslar
        let globalChannel: any = null
        let presenceChannel: any = null
        let heartbeatInterval: any = null
        let setupTimeout: any = null

        // Data fetch'lerin önce tamamlanması için realtime subscription'ları geciktir
        // Bu, connection pool'un data istekleri için kullanılabilir olmasını sağlar
        setupTimeout = setTimeout(() => {
            // Global Supabase channel
            globalChannel = supabase
                .channel('global-updates', {
                    config: {
                        broadcast: { self: false },
                        presence: { key: '' }
                    }
                })
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'room_deletions',
                    filter: `user_id=eq.${session.user.id}`
                }, (payload: any) => {
                    const deletedRoomId = payload.new.room_id
                    setRooms((prevRooms: Room[]) => prevRooms.filter(r => r.id !== deletedRoomId))
                    setCurrentRoom((prevRoom: Room | null) => prevRoom?.id === deletedRoomId ? null : prevRoom)
                })
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'room_invitations',
                    filter: `invitee_id=eq.${session.user.id}`
                }, () => fetchPendingInvitations())
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'room_invitations',
                    filter: `invitee_id=eq.${session.user.id}`
                }, () => fetchPendingInvitations())
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'friend_requests',
                    filter: `receiver_id=eq.${session.user.id}`
                }, () => fetchFriendRequests())
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'friend_requests',
                    filter: `receiver_id=eq.${session.user.id}`
                }, () => fetchFriendRequests())
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'friends',
                    filter: `user_id=eq.${session.user.id}`
                }, () => fetchFriends())
                .on('postgres_changes', {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'friends',
                    filter: `user_id=eq.${session.user.id}`
                }, () => fetchFriends())
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'room_members',
                    filter: `user_id=eq.${session.user.id}`
                }, () => debouncedFetchRooms())
                .on('postgres_changes', {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'room_members',
                    filter: `user_id=eq.${session.user.id}`
                }, (payload: any) => {
                    debouncedFetchRooms()
                    if (currentRoomRef.current?.id === payload.old.room_id) {
                        setCurrentRoom(null)
                    }
                })
                .subscribe()

            // Presence channel
            presenceChannel = supabase.channel('online-users', {
                config: {
                    broadcast: { self: true },
                    presence: { key: session.user.id }
                }
            })

            const updatePresence = (isVisible = true) => {
                if (!presenceSubscribedRef.current) return

                if (isVisible) {
                    presenceChannel.track({
                        user_id: session.user.id,
                        online: true,
                        last_seen: new Date().toISOString(),
                        status: 'online'
                    })
                } else {
                    presenceChannel.untrack()
                }
            }

            const handleVisibilityChange = () => {
                updatePresence(document.visibilityState === 'visible')
            }

            const handleBeforeUnload = () => {
                presenceChannel.untrack()
            }

            document.addEventListener('visibilitychange', handleVisibilityChange)
            window.addEventListener('beforeunload', handleBeforeUnload)

            heartbeatInterval = setInterval(() => {
                if (document.visibilityState === 'visible') {
                    updatePresence(true)
                }
            }, 10000)

            // Presence sync handler
            const processPresenceState = (presenceState: any) => {
                const onlineUsersSet = new Set<string>()
                const presenceMap = new Map<string, { online: boolean; lastSeen: string }>()

                if (presenceState && typeof presenceState === 'object') {
                    Object.entries(presenceState).forEach(([key, presences]: [string, any]) => {
                        const presencesArray = Array.isArray(presences) ? presences : [presences]
                        presencesArray.forEach((presence: any) => {
                            const userId = presence.user_id || key
                            if (userId) {
                                const isOnline = presence.online !== false
                                const existing = presenceMap.get(userId)

                                const finalOnlineStatus = isOnline || (existing?.online || false)

                                presenceMap.set(userId, {
                                    online: finalOnlineStatus,
                                    lastSeen: presence.last_seen || existing?.lastSeen || new Date().toISOString()
                                })

                                if (finalOnlineStatus) {
                                    onlineUsersSet.add(userId)
                                }
                            }
                        })
                    })
                }

                setOnlineUsers(onlineUsersSet)
                setUserPresence((prev: Map<string, { online: boolean; lastSeen: string }>) => {
                    const newPresenceMap = new Map<string, { online: boolean; lastSeen: string }>()
                    prev.forEach((value, key) => {
                        newPresenceMap.set(key, {
                            online: false,
                            lastSeen: value.lastSeen || new Date().toISOString()
                        })
                    })

                    presenceMap.forEach((value, key) => {
                        newPresenceMap.set(key, value)
                    })
                    return newPresenceMap
                })
            }

            presenceChannel
                .on('presence', { event: 'sync' }, () => {
                    try {
                        processPresenceState(presenceChannel.presenceState())
                    } catch (error) {
                        console.error('Error processing presence sync:', error)
                    }
                })
                .on('presence', { event: 'join' }, () => {
                    processPresenceState(presenceChannel.presenceState())
                })
                .on('presence', { event: 'leave' }, () => {
                    processPresenceState(presenceChannel.presenceState())
                })
                .subscribe(async (status: string) => {
                    if (status === 'SUBSCRIBED') {
                        presenceSubscribedRef.current = true
                        updatePresence(true)

                        setTimeout(() => {
                            const presenceState = presenceChannel.presenceState()
                            if (presenceState && Object.keys(presenceState).length > 0) {
                                processPresenceState(presenceState)
                            }
                        }, 500)
                    }
                })
        }, 500) // 500ms gecikme - data fetch'lerin önce tamamlanması için

        return () => {
            socket.off('newMessage', handleUnifiedNewMessage)
            socket.off('messages_read')
            if (setupTimeout) clearTimeout(setupTimeout)
            if (globalChannel) supabase.removeChannel(globalChannel)
            if (heartbeatInterval) clearInterval(heartbeatInterval)
            if (presenceChannel) {
                presenceChannel.untrack()
                supabase.removeChannel(presenceChannel)
            }
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session.user.id, setLastMessages, setUnreadCounts, setRooms, setCurrentRoom, fetchPendingInvitations, fetchFriendRequests, fetchFriends, debouncedFetchRooms, setOnlineUsers, setUserPresence, currentRoomRef, presenceSubscribedRef])

    // Room değişikliklerinde Socket.IO room join/leave
    useEffect(() => {
        if (currentRoom?.is_provisional) {
            setMessages([])
            return
        }

        if (currentRoom) {
            setUnreadCounts((prev: UnreadCounts) => ({ ...prev, [currentRoom.id]: 0 }))
            fetchMessages(currentRoom.id)

            const channel = supabase
                .channel(`room:${currentRoom.id}`, {
                    config: {
                        broadcast: { self: false },
                        presence: { key: '' }
                    }
                })
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'message_deletions',
                    filter: `user_id=eq.${session.user.id}`
                }, (payload: any) => {
                    const deletedId = payload.new.message_id
                    if (state.deletedMessageIdsRef?.current) {
                        state.deletedMessageIdsRef.current.add(deletedId)
                    }
                    setMessages((prev: Message[]) => prev.filter(msg => msg.id !== deletedId))
                })
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentRoom, session.user.id, setUnreadCounts, fetchMessages, setMessages, setLastMessages, setCurrentRoom])

    // Odalar yüklendiğinde tüm odalara join ol (Socket.IO room-based broadcast için)
    useEffect(() => {
        if (state.rooms.length === 0) return
        const socket = getSocket(session.access_token)
        state.rooms.forEach(room => {
            if (room.id && !room.is_provisional) {
                socket.emit('joinRoom', room.id)
            }
        })
    }, [state.rooms])

    useEffect(() => {
        setRooms((prevRooms: Room[]) => prevRooms.map(room => {
            if (room.type === 'dm' && room.otherUser) {
                return {
                    ...room,
                    otherUser: {
                        ...room.otherUser,
                        online: onlineUsers.has(room.otherUser.id)
                    }
                }
            }
            return room
        }))

        setFriends((prevFriends: Friend[]) => prevFriends.map(friend => ({
            ...friend,
            online: friend.friend_id ? onlineUsers.has(friend.friend_id) : (friend.id ? onlineUsers.has(friend.id) : false)
        })))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onlineUsers, setRooms, setFriends])
}

export default useSocketAndPresence
