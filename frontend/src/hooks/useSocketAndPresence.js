import { useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { getSocket } from '../socket'

/**
 * Socket.IO ve Supabase Presence yönetimi için custom hook
 */
export function useSocketAndPresence(session, state, dataFunctions) {
    const {
        currentRoom, setCurrentRoom,
        messages, setMessages,
        setRooms, setUnreadCounts, setLastMessages,
        setOnlineUsers, setUserPresence,
        setFriends,
        currentRoomRef, presenceSubscribedRef,
    } = state

    const {
        debouncedFetchRooms,
        fetchFriendRequests, fetchFriends,
        fetchPendingInvitations, fetchMessages,
        getUserData
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
        const socket = getSocket()

        const handleGlobalNewMessage = (messageWithUser) => {
            setLastMessages(prev => ({
                ...prev,
                [messageWithUser.room_id]: {
                    id: messageWithUser.id,
                    content: messageWithUser.content,
                    message_type: messageWithUser.message_type,
                    user_id: messageWithUser.user_id,
                    created_at: messageWithUser.created_at,
                    user: messageWithUser.user || messageWithUser.userData
                }
            }))

            if (messageWithUser.user_id === session.user.id) {
                return
            }

            const openRoom = currentRoomRef.current
            if (!openRoom || openRoom.id !== messageWithUser.room_id) {
                const lastOpenKey = `lastOpen_${messageWithUser.room_id}`
                const lastOpen = localStorage.getItem(lastOpenKey)

                if (!lastOpen || new Date(messageWithUser.created_at) > new Date(lastOpen)) {
                    setUnreadCounts(prev => ({
                        ...prev,
                        [messageWithUser.room_id]: (prev[messageWithUser.room_id] || 0) + 1
                    }))
                }
            }
        }

        socket.on('globalNewMessage', handleGlobalNewMessage)

        // Realtime channels için referanslar
        let globalChannel = null
        let presenceChannel = null
        let heartbeatInterval = null
        let setupTimeout = null

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
                }, (payload) => {
                    const deletedRoomId = payload.new.room_id
                    setRooms(prevRooms => prevRooms.filter(r => r.id !== deletedRoomId))
                    setCurrentRoom(prevRoom => prevRoom?.id === deletedRoomId ? null : prevRoom)
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
                }, (payload) => {
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
            const processPresenceState = (presenceState) => {
                const onlineUsersSet = new Set()
                const presenceMap = new Map()

                if (presenceState && typeof presenceState === 'object') {
                    Object.entries(presenceState).forEach(([key, presences]) => {
                        const presencesArray = Array.isArray(presences) ? presences : [presences]
                        presencesArray.forEach((presence) => {
                            const userId = presence.user_id || key
                            if (userId) {
                                const isOnline = presence.online !== false
                                const existing = presenceMap.get(userId)

                                const finalOnlineStatus = isOnline || (existing?.online || false)

                                presenceMap.set(userId, {
                                    online: finalOnlineStatus,
                                    last_seen: presence.last_seen || existing?.last_seen || new Date().toISOString()
                                })

                                if (finalOnlineStatus) {
                                    onlineUsersSet.add(userId)
                                }
                            }
                        })
                    })
                }

                setOnlineUsers(onlineUsersSet)
                setUserPresence(prev => {
                    const newPresenceMap = new Map()
                    prev.forEach((value, key) => {
                        newPresenceMap.set(key, {
                            online: false,
                            last_seen: value.last_seen || new Date().toISOString()
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
                .subscribe(async (status) => {
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
            socket.off('globalNewMessage', handleGlobalNewMessage)
            if (setupTimeout) clearTimeout(setupTimeout)
            if (globalChannel) supabase.removeChannel(globalChannel)
            if (heartbeatInterval) clearInterval(heartbeatInterval)
            if (presenceChannel) {
                presenceChannel.untrack()
                supabase.removeChannel(presenceChannel)
            }
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session.user.id])

    // Room değişikliklerinde Socket.IO room join/leave
    useEffect(() => {
        if (currentRoom) {
            setUnreadCounts(prev => ({ ...prev, [currentRoom.id]: 0 }))
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
                }, (payload) => {
                    setMessages((prev) => prev.filter(msg => msg.id !== payload.new.message_id))
                })
                .subscribe()

            const socket = getSocket()
            socket.emit('joinRoom', currentRoom.id)

            const handleRoomNewMessage = (messageWithUser) => {
                if (messageWithUser.room_id !== currentRoom.id) return

                setLastMessages(prev => ({
                    ...prev,
                    [messageWithUser.room_id]: {
                        id: messageWithUser.id,
                        content: messageWithUser.content,
                        message_type: messageWithUser.message_type,
                        user_id: messageWithUser.user_id,
                        created_at: messageWithUser.created_at,
                        user: messageWithUser.user || messageWithUser.userData
                    }
                }))

                setMessages((prev) => {
                    const exists = prev.some(msg => msg.id === messageWithUser.id)
                    if (exists) return prev

                    const newMessages = [...prev, messageWithUser]
                    const uniqueMessages = []
                    const seenIds = new Set()
                    for (let i = newMessages.length - 1; i >= 0; i--) {
                        if (!seenIds.has(newMessages[i].id)) {
                            seenIds.add(newMessages[i].id)
                            uniqueMessages.unshift(newMessages[i])
                        }
                    }
                    return uniqueMessages
                })
            }

            socket.on('newMessage', handleRoomNewMessage)

            socket.on('messages_read', ({ roomId }) => {
                if (roomId !== currentRoom.id) return
                setMessages(prev => {
                    const hasUnread = prev.some(msg => msg.user_id === session.user.id && msg.status !== 'read')
                    if (!hasUnread) return prev
                    return prev.map(msg => {
                        if (msg.user_id === session.user.id && msg.status !== 'read') {
                            return { ...msg, status: 'read' }
                        }
                        return msg
                    })
                })
            })

            return () => {
                supabase.removeChannel(channel)
                socket.off('newMessage', handleRoomNewMessage)
                socket.off('messages_read')
                socket.emit('leaveRoom', currentRoom.id)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentRoom, session.user.id])

    // Online users değişikliklerini rooms ve friends'e yansıt
    useEffect(() => {
        const { onlineUsers } = state

        setRooms(prevRooms => prevRooms.map(room => {
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

        setFriends(prevFriends => prevFriends.map(friend => ({
            ...friend,
            online: onlineUsers.has(friend.friend_id || friend.id)
        })))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.onlineUsers])
}

export default useSocketAndPresence
