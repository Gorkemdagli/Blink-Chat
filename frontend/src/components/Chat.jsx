import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { z } from 'zod'
import DOMPurify from 'dompurify'
import { supabase } from '../supabaseClient'
import { getSocket, disconnectSocket } from '../socket'
import Sidebar from './Sidebar'
import ChatWindow from './ChatWindow'
import CreateGroupModal from './CreateGroupModal'
import AddFriendModal from './AddFriendModal'

// XSS kontrolü yapan fonksiyon
export const containsXSS = (msg) => {
    const clean = DOMPurify.sanitize(msg);
    // Eğer temizlenmiş hali orijinalinden farklıysa, zararlı içerik var demektir
    // Ancak sadece boşluk farklarını göz ardı edelim
    return clean.trim() !== msg.trim();
}

export const messageSchema = z.string()
    .min(1, "Mesaj boş olamaz")
    .max(2000, "Mesaj çok uzun")
    .refine(msg => !containsXSS(msg), { message: "Geçersiz içerik (HTML veya Script içeremez)" })

export default function Chat({ session, darkMode, onToggleDarkMode }) {
    const [rooms, setRooms] = useState([])
    const [users, setUsers] = useState([])
    const [currentRoom, setCurrentRoom] = useState(null)
    const [unreadCounts, setUnreadCounts] = useState({}) // { roomId: count }
    const [lastMessages, setLastMessages] = useState({}) // { roomId: { content, user_id, created_at } }
    const [messages, setMessages] = useState([])
    const [newMessage, setNewMessage] = useState('')
    const [activeTab, setActiveTab] = useState('rooms')
    const [isLoadingRooms, setIsLoadingRooms] = useState(false)
    const [isLoadingMessages, setIsLoadingMessages] = useState(false)
    const currentRoomRef = useRef(null) // 📬 UNREAD: currentRoom'u ref olarak tut (realtime listener için)
    const presenceSubscribedRef = useRef(false) // 🌐 PRESENCE: Subscribe durumunu takip et

    // 📄 PAGINATION: Mesaj sayfalama için state'ler
    const [hasMoreMessages, setHasMoreMessages] = useState(false)
    const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false)
    const [oldestMessageId, setOldestMessageId] = useState(null)
    const MESSAGE_LIMIT = 50 // Her seferinde kaç mesaj yüklenecek

    // 🚀 PERFORMANS: User Cache - Her mesajda kullanıcı bilgisi çekmemek için
    const userCacheRef = useRef(new Map())

    // 🎯 INVITATION SYSTEM: Davet sistemi için state'ler
    const [showInviteModal, setShowInviteModal] = useState(false)
    const [pendingInvitations, setPendingInvitations] = useState([])
    const [showInvitationsPanel, setShowInvitationsPanel] = useState(false)

    // 🆔 USER CODE: Kullanıcı bilgileri (code dahil)
    const [currentUser, setCurrentUser] = useState(null)

    // 👥 FRIENDS SYSTEM: Arkadaşlık sistemi
    const [friends, setFriends] = useState([])
    const [friendRequests, setFriendRequests] = useState([])
    const [showAddFriendModal, setShowAddFriendModal] = useState(false)
    const [friendCode, setFriendCode] = useState('')

    // 🌐 PRESENCE: Online kullanıcıları takip et
    const [onlineUsers, setOnlineUsers] = useState(new Set()) // Online kullanıcı ID'leri
    const [userPresence, setUserPresence] = useState(new Map()) // Kullanıcı presence bilgileri (user_id -> { online, last_seen })

    // 🏠 CREATE ROOM: Oda oluşturma modal
    const [showCreateRoomModal, setShowCreateRoomModal] = useState(false)
    const [newRoomName, setNewRoomName] = useState('')
    const [selectedFriendsForRoom, setSelectedFriendsForRoom] = useState([])
    const [view, setView] = useState('sidebar') // 'sidebar' | 'chat' for mobile

    // 🔔 TOAST: Bildirim sistemi
    const [toast, setToast] = useState(null) // { message, type: 'success' | 'error' | 'info' }

    // ⚡ PERFORMANS: Debounce için timeout ref
    const fetchRoomsTimeoutRef = useRef(null)

    // Kullanıcı bilgisini cache'den al veya fetch et
    const getUserData = async (userId) => {
        // Cache'de varsa direkt döndür
        if (userCacheRef.current.has(userId)) {
            return userCacheRef.current.get(userId)
        }

        // Cache'de yoksa fetch et
        const { data, error } = await supabase
            .from('users')
            .select('id, username, email, user_code, avatar_url')
            .eq('id', userId)
            .maybeSingle()

        if (error) {
            console.error('Error fetching user data:', error)
            return null
        }

        // Cache'e ekle
        if (data) {
            userCacheRef.current.set(userId, data)
        }

        return data
    }

    // Toplu kullanıcı bilgilerini cache'e ekle (batch işlemler için)
    const cacheUsers = (usersData) => {
        usersData?.forEach(user => {
            if (user?.id) {
                userCacheRef.current.set(user.id, user)
            }
        })
    }

    // 🔔 TOAST: Bildirim göster
    const showToast = (message, type = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    // ⚡ PERFORMANS: Debounced fetchRooms - çok sık çağrılmasını önler
    const debouncedFetchRooms = () => {
        if (fetchRoomsTimeoutRef.current) {
            clearTimeout(fetchRoomsTimeoutRef.current)
        }
        fetchRoomsTimeoutRef.current = setTimeout(() => {
            fetchRooms()
        }, 500) // 500ms debounce
    }

    useEffect(() => {
        fetchCurrentUser() // 🆔 Kendi bilgilerimizi al
        fetchRooms()
        fetchFriends() // 👥 Arkadaşları al
        fetchFriendRequests() // 👥 Friend requests al
        // ⚡ PERFORMANS: fetchUsers() kaldırıldı - modal açılırken lazy load
        fetchPendingInvitations()

        // 🚀 GLOBAL Socket.IO: Tüm mesajları dinle (unread count için)
        const socket = getSocket()
        const handleGlobalNewMessage = (messageWithUser) => {
            // 💬 Son mesajı güncelle (kullanıcı bilgisiyle birlikte)
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

            // Kendi mesajımızsa sayma
            if (messageWithUser.user_id === session.user.id) {
                return
            }

            // Eğer bu oda açık DEĞİLse, badge artır
            const openRoom = currentRoomRef.current
            if (!openRoom || openRoom.id !== messageWithUser.room_id) {
                // Başka odadan mesaj geldi
                const lastOpenKey = `lastOpen_${messageWithUser.room_id}`
                const lastOpen = localStorage.getItem(lastOpenKey)

                // Mesaj lastOpen'dan sonra mı?
                if (!lastOpen || new Date(messageWithUser.created_at) > new Date(lastOpen)) {
                    // Unread count artır
                    setUnreadCounts(prev => ({
                        ...prev,
                        [messageWithUser.room_id]: (prev[messageWithUser.room_id] || 0) + 1
                    }))
                }
            }
        }

        socket.on('globalNewMessage', handleGlobalNewMessage)

        // Global listener: Room deletions ve invitations için
        const globalChannel = supabase
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
            }, async (payload) => {
                const deletedRoomId = payload.new.room_id
                setRooms(prevRooms => prevRooms.filter(r => r.id !== deletedRoomId))
                setCurrentRoom(prevRoom => prevRoom?.id === deletedRoomId ? null : prevRoom)
            })
            // 🎯 INVITATION SYSTEM: Yeni davet geldiğinde realtime güncelleme
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'room_invitations',
                filter: `invitee_id=eq.${session.user.id}`
            }, async (payload) => {
                fetchPendingInvitations()
            })
            // 🎯 INVITATION SYSTEM: Davet güncellendiğinde (kabul/red)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'room_invitations',
                filter: `invitee_id=eq.${session.user.id}`
            }, async (payload) => {
                fetchPendingInvitations()
            })
            // 👥 FRIENDS: Yeni friend request geldiğinde
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'friend_requests',
                filter: `receiver_id=eq.${session.user.id}`
            }, async (payload) => {
                fetchFriendRequests()
            })
            // 👥 FRIENDS: Friend request güncellendiğinde (kabul/red)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'friend_requests',
                filter: `receiver_id=eq.${session.user.id}`
            }, async (payload) => {
                fetchFriendRequests()
            })
            // 👥 FRIENDS: Yeni arkadaş eklendiğinde
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'friends',
                filter: `user_id=eq.${session.user.id}`
            }, async (payload) => {
                fetchFriends()
            })
            // 👥 FRIENDS: Arkadaşlık silindiğinde
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'friends',
                filter: `user_id=eq.${session.user.id}`
            }, async (payload) => {
                fetchFriends()
            })
            // 💬 ROOMS: Yeni oda oluşturulduğunda veya üye eklendiğinde
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'room_members',
                filter: `user_id=eq.${session.user.id}`
            }, async (payload) => {
                debouncedFetchRooms() // ⚡ PERFORMANS: Debounced
            })
            // 💬 ROOMS: Odadan çıkarıldığımızda
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'room_members',
                filter: `user_id=eq.${session.user.id}`
            }, async (payload) => {
                debouncedFetchRooms() // ⚡ PERFORMANS: Debounced
                if (currentRoom?.id === payload.old.room_id) {
                    setCurrentRoom(null)
                }
            })
            .subscribe()

        // 🌐 PRESENCE: Online/Offline tracking için presence channel
        const presenceChannel = supabase.channel('online-users', {
            config: {
                broadcast: { self: true }, // Kendi presence'imizi de görelim
                presence: {
                    key: session.user.id, // Her kullanıcı için unique key
                }
            }
        })

        // Presence state'i güncelle
        const updatePresence = (isVisible = true) => {
            // Sadece subscribe olduktan sonra presence gönder
            if (!presenceSubscribedRef.current) {
                return
            }

            if (isVisible) {
                presenceChannel.track({
                    user_id: session.user.id,
                    online: true,
                    last_seen: new Date().toISOString(),
                    status: 'online'
                })
            } else {
                // Offline durumunda presence'i kaldır
                presenceChannel.untrack()
            }
        }

        // Browser Visibility API - Sekme değişikliklerini dinle
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // Sekme aktif - online
                updatePresence(true)
            } else {
                // Sekme pasif - offline
                updatePresence(false)
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        // Window focus/blur event'leri (ek güvenlik)
        const handleFocus = () => updatePresence(true)
        const handleBlur = () => updatePresence(false)

        window.addEventListener('focus', handleFocus)
        window.addEventListener('blur', handleBlur)

        // Heartbeat: Her 10 saniyede bir presence'i güncelle (bağlantının aktif olduğunu göster)
        const heartbeatInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                updatePresence(true)
            }
        }, 10000) // 10 saniye

        // Diğer kullanıcıların presence değişikliklerini dinle
        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                try {
                    const state = presenceChannel.presenceState()

                    // Tüm online kullanıcıları al ve presence bilgilerini kaydet
                    const onlineUsersSet = new Set()
                    const presenceMap = new Map()

                    // State bir obje, her key bir kullanıcı ID'si (veya presence key)
                    if (state && typeof state === 'object') {
                        Object.entries(state).forEach(([key, presences]) => {
                            // presences bir array olabilir
                            const presencesArray = Array.isArray(presences) ? presences : [presences]

                            presencesArray.forEach((presence) => {
                                // Presence objesi içindeki user_id'yi bul
                                const userId = presence.user_id || key

                                if (userId) {
                                    const isOnline = presence.online !== false // Default true
                                    // last_seen için mevcut state'i kontrol edeceğiz (callback içinde)
                                    presenceMap.set(userId, {
                                        online: isOnline,
                                        last_seen: presence.last_seen // Sync'te gelen değer, callback'te merge edilecek
                                    })

                                    if (isOnline) {
                                        onlineUsersSet.add(userId)
                                    }
                                }
                            })
                        })
                    }

                    // Online kullanıcıları state'e kaydet
                    setOnlineUsers(onlineUsersSet)
                    // Mevcut presence bilgilerini koru (last_seen için)
                    setUserPresence(prev => {
                        const mergedMap = new Map(prev)
                        // Yeni presence bilgilerini ekle veya güncelle
                        presenceMap.forEach((value, key) => {
                            const existing = prev.get(key)
                            // last_seen'i koru: önce yeni olandan, sonra mevcut olandan
                            mergedMap.set(key, {
                                online: value.online,
                                last_seen: value.last_seen || existing?.last_seen || new Date().toISOString()
                            })
                        })
                        return mergedMap
                    })
                } catch (error) {
                    console.error('🌐 Error processing presence sync:', error)
                }
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                // Yeni kullanıcı online oldu
                setOnlineUsers(prev => {
                    const newSet = new Set(prev)
                    const presencesArray = Array.isArray(newPresences) ? newPresences : [newPresences]

                    presencesArray.forEach((presence) => {
                        const userId = presence.user_id || key
                        if (userId && (presence.online !== false)) {
                            newSet.add(userId)
                        }
                    })
                    return newSet
                })

                // Presence bilgilerini güncelle (mevcut last_seen'i koru)
                setUserPresence(prev => {
                    const newMap = new Map(prev)
                    const presencesArray = Array.isArray(newPresences) ? newPresences : [newPresences]

                    presencesArray.forEach((presence) => {
                        const userId = presence.user_id || key
                        if (userId) {
                            // Mevcut presence bilgisini al (last_seen'i korumak için)
                            const existing = prev.get(userId)
                            // last_seen: önce presence'ten, sonra mevcut olandan, yoksa şu anki zaman
                            const lastSeen = presence.last_seen || existing?.last_seen || new Date().toISOString()

                            newMap.set(userId, {
                                online: presence.online !== false,
                                last_seen: lastSeen
                            })
                        }
                    })
                    // Yeni Map oluştur (React re-render için)
                    return new Map(newMap)
                })
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                // Kullanıcı offline oldu - last_seen'i kaydet
                setOnlineUsers(prev => {
                    const newSet = new Set(prev)
                    const presencesArray = Array.isArray(leftPresences) ? leftPresences : [leftPresences]

                    presencesArray.forEach((presence) => {
                        const userId = presence.user_id || key
                        if (userId) {
                            newSet.delete(userId)
                        }
                    })
                    return newSet
                })

                // Offline olduğunda last_seen'i güncelle (mevcut bilgiyi koru)
                setUserPresence(prev => {
                    const newMap = new Map(prev)
                    const presencesArray = Array.isArray(leftPresences) ? leftPresences : [leftPresences]

                    presencesArray.forEach((presence) => {
                        const userId = presence.user_id || key
                        if (userId) {
                            // Mevcut presence bilgisini al (varsa)
                            const existingPresence = prev.get(userId)
                            // last_seen bilgisini koru: önce presence'ten, sonra mevcut olandan, yoksa şu anki zaman
                            const lastSeen = presence.last_seen || existingPresence?.last_seen || new Date().toISOString()

                            newMap.set(userId, {
                                online: false,
                                last_seen: lastSeen
                            })
                        }
                    })
                    // Yeni Map oluştur (React re-render için)
                    return new Map(newMap)
                })
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    // Bağlantı başarılı, subscribe flag'ini set et
                    presenceSubscribedRef.current = true
                    // İlk presence'i gönder
                    updatePresence(true)

                    // Presence state'ini kontrol et (sync event gelmemiş olabilir)
                    setTimeout(() => {
                        const state = presenceChannel.presenceState()
                        if (state && Object.keys(state).length > 0) {
                            // State'i manuel olarak işle
                            const onlineUsersSet = new Set()
                            const presenceMap = new Map()

                            Object.entries(state).forEach(([key, presences]) => {
                                const presencesArray = Array.isArray(presences) ? presences : [presences]
                                presencesArray.forEach((presence) => {
                                    const userId = presence.user_id || key
                                    if (userId) {
                                        const isOnline = presence.online !== false
                                        const lastSeen = presence.last_seen || new Date().toISOString()

                                        if (isOnline) {
                                            onlineUsersSet.add(userId)
                                        }

                                        presenceMap.set(userId, {
                                            online: isOnline,
                                            last_seen: lastSeen
                                        })
                                    }
                                })
                            })

                            setOnlineUsers(onlineUsersSet)
                            // Mevcut presence bilgilerini koru (last_seen için)
                            setUserPresence(prev => {
                                const mergedMap = new Map(prev)
                                // Yeni presence bilgilerini ekle veya güncelle
                                presenceMap.forEach((value, key) => {
                                    const existing = prev.get(key)
                                    // last_seen'i koru: önce yeni olandan, sonra mevcut olandan
                                    mergedMap.set(key, {
                                        online: value.online,
                                        last_seen: value.last_seen || existing?.last_seen || new Date().toISOString()
                                    })
                                })
                                return mergedMap
                            })
                        }
                    }, 500)
                }
            })

        return () => {
            socket.off('globalNewMessage', handleGlobalNewMessage)
            supabase.removeChannel(globalChannel)
            // Presence cleanup
            clearInterval(heartbeatInterval)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('focus', handleFocus)
            window.removeEventListener('blur', handleBlur)
            presenceChannel.untrack()
            supabase.removeChannel(presenceChannel)
        }
    }, [session.user.id])

    useEffect(() => {
        // 📬 UNREAD: Önceki odadan ayrılırken lastOpen'ı güncelle
        return () => {
            if (currentRoom && messages.length > 0) {
                const lastMessage = messages[messages.length - 1]
                const lastOpenKey = `lastOpen_${currentRoom.id}`
                localStorage.setItem(lastOpenKey, lastMessage.created_at)
            }
        }
    }, [currentRoom, messages])

    useEffect(() => {
        // 📬 UNREAD: Ref'i güncelle (realtime listener için)
        currentRoomRef.current = currentRoom

        if (currentRoom) {
            // 📬 UNREAD: Oda açıldığında HEMEN badge'i sıfırla (fetchMessages'dan önce!)
            setUnreadCounts(prev => ({ ...prev, [currentRoom.id]: 0 }))

            fetchMessages(currentRoom.id)
            // 📬 UNREAD: lastOpen, oda değiştirildiğinde/kapatıldığında güncelleniyor

            // 🔄 Supabase Realtime Channel - Messages için
            const channel = supabase
                .channel(`room:${currentRoom.id}`, {
                    config: {
                        broadcast: { self: false },
                        presence: { key: '' }
                    }
                })
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages',
                    filter: `room_id=eq.${currentRoom.id}`
                }, (payload) => {
                    // Mesajın durumunu veya içeriğini güncelle
                    setMessages(prev => prev.map(msg =>
                        msg.id === payload.new.id ? { ...msg, ...payload.new } : msg
                    ))
                })
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `room_id=eq.${currentRoom.id}`
                }, async (payload) => {
                    // 🚀 PERFORMANS: Cache'den kullanıcı bilgisi al
                    const userData = await getUserData(payload.new.user_id)

                    // 💬 Son mesajı güncelle (kullanıcı bilgisiyle birlikte)
                    setLastMessages(prev => ({
                        ...prev,
                        [payload.new.room_id]: {
                            id: payload.new.id,
                            content: payload.new.content,
                            user_id: payload.new.user_id,
                            created_at: payload.new.created_at,
                            user: userData
                        }
                    }))

                    // Duplicate check (Socket.IO da göndermiş olabilir) - Daha güvenli
                    setMessages((prev) => {
                        const exists = prev.some(msg => msg.id === payload.new.id)
                        if (exists) {
                            return prev
                        }
                        // Yeni mesajı ekle ve duplicate'leri temizle (güvenlik için)
                        const newMessages = [...prev, { ...payload.new, user: userData }]
                        // ID'ye göre unique yap (son eklenen öncelikli)
                        const uniqueMessages = []
                        const seenIds = new Set()
                        // Ters sırada kontrol et (son eklenenler önce)
                        for (let i = newMessages.length - 1; i >= 0; i--) {
                            if (!seenIds.has(newMessages[i].id)) {
                                seenIds.add(newMessages[i].id)
                                uniqueMessages.unshift(newMessages[i])
                            }
                        }
                        return uniqueMessages
                    })
                })
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'message_deletions',
                    filter: `user_id=eq.${session.user.id}`
                }, (payload) => {
                    // Remove message from UI when user deletes it
                    setMessages((prev) => prev.filter(msg => msg.id !== payload.new.message_id))
                })
                .on('postgres_changes', {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'messages',
                    filter: `room_id=eq.${currentRoom.id}`
                }, (payload) => {
                    // Remove message from UI when it's permanently deleted
                    setMessages((prev) => prev.filter(msg => msg.id !== payload.old.id))
                })
                .subscribe()

            // Socket room'a katıl
            const socket = getSocket()
            socket.emit('joinRoom', currentRoom.id)

            // 🚀 Socket.IO listener: Hızlı mesaj delivery (room-specific)
            const handleRoomNewMessage = (messageWithUser) => {
                // Bu odanın mesajı mı kontrol et
                if (messageWithUser.room_id !== currentRoom.id) {
                    return
                }

                // 💬 Son mesajı güncelle (kullanıcı bilgisiyle birlikte)
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

                // Duplicate check (Supabase Realtime de gönderebilir) - Daha güvenli
                setMessages((prev) => {
                    const exists = prev.some(msg => msg.id === messageWithUser.id)
                    if (exists) {
                        return prev
                    }

                    // Yeni mesajı ekle ve duplicate'leri temizle (güvenlik için)
                    const newMessages = [...prev, messageWithUser]
                    // ID'ye göre unique yap (son eklenen öncelikli)
                    const uniqueMessages = []
                    const seenIds = new Set()
                    // Ters sırada kontrol et (son eklenenler önce)
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

            socket.on('messages_read', ({ roomId, userId }) => {
                if (roomId !== currentRoom.id) return
                // Update my messages to read
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
                // Socket room'dan ayrıl
                socket.emit('leaveRoom', currentRoom.id)
            }
        }
    }, [currentRoom, session.user.id])

    // 🌐 PRESENCE: Online users değiştiğinde rooms ve friends'teki online durumlarını güncelle
    useEffect(() => {
        // Rooms'daki online durumlarını güncelle
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

        // Friends'teki online durumlarını güncelle
        setFriends(prevFriends => prevFriends.map(friend => ({
            ...friend,
            online: onlineUsers.has(friend.friend_id || friend.id)
        })))
    }, [onlineUsers])

    // 📄 PAGINATION: Scroll yönetimi artık ChatWindow içinde yapılıyor
    // Eski scroll listener'lar kaldırıldı - ChatWindow kendi scroll'unu yönetiyor

    // 💬 Son mesajları getir (her oda için)
    const fetchLastMessages = async (roomIds) => {
        if (!roomIds || roomIds.length === 0) {
            setLastMessages({})
            return
        }

        try {
            // Her oda için son mesajı çek (silinen mesajları hariç tut)
            const { data: deletions } = await supabase
                .from('message_deletions')
                .select('message_id')
                .eq('user_id', session.user.id)

            const deletedMessageIds = new Set(deletions?.map(d => d.message_id) || [])

            // Her oda için son mesajı al
            const lastMessagesObj = {}

            // Paralel olarak her oda için son mesajı çek
            const promises = roomIds.map(async (roomId) => {
                const { data, error } = await supabase
                    .from('messages')
                    .select('id, content, message_type, user_id, created_at')
                    .eq('room_id', roomId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (error) {
                    console.error(`Error fetching last message for room ${roomId}:`, error)
                    return null
                }

                // Silinen mesajları hariç tut
                if (data && !deletedMessageIds.has(data.id)) {
                    // Kullanıcı bilgisini cache'den al veya fetch et
                    let userData = userCacheRef.current.get(data.user_id)
                    if (!userData) {
                        userData = await getUserData(data.user_id)
                    }

                    return {
                        roomId,
                        message: {
                            ...data,
                            user: userData
                        }
                    }
                }
                return null
            })

            const results = await Promise.all(promises)
            results.forEach(result => {
                if (result && result.message) {
                    lastMessagesObj[result.roomId] = result.message
                }
            })

            setLastMessages(lastMessagesObj)
        } catch (error) {
            console.error('Error fetching last messages:', error)
        }
    }

    // 📬 UNREAD: Okunmamış mesaj sayılarını getir
    // ⚡ PERFORMANS: Optimize edildi - tek query ile tüm odalar
    const fetchUnreadCounts = async () => {
        try {
            // Her oda için son mesajı ve kendi mesajlarımızı hariç tutarak say
            const { data: memberRooms, error: memberError } = await supabase
                .from('room_members')
                .select('room_id')
                .eq('user_id', session.user.id)

            if (memberError) {
                console.error('❌ room_members fetch error:', memberError)
                return
            }

            if (!memberRooms || memberRooms.length === 0) {
                setUnreadCounts({})
                return
            }

            const roomIds = memberRooms.map(m => m.room_id)

            // ⚡ PERFORMANS: Tek query ile TÜM odaların mesajlarını çek
            const { data: allMessages, error: messagesError } = await supabase
                .from('messages')
                .select('id, created_at, user_id, room_id')
                .in('room_id', roomIds)
                .neq('user_id', session.user.id)
                .order('created_at', { ascending: false })

            if (messagesError) {
                console.error('❌ messages fetch error:', messagesError)
                return
            }

            // JavaScript'te room_id'ye göre grupla ve say
            const countsObj = {}

            roomIds.forEach(roomId => {
                const lastOpenKey = `lastOpen_${roomId}`
                const lastOpen = localStorage.getItem(lastOpenKey)

                // Bu odanın mesajlarını filtrele
                const roomMessages = allMessages?.filter(m => m.room_id === roomId) || []

                if (!lastOpen) {
                    // lastOpen yoksa, en son mesajın zamanını lastOpen olarak ayarla
                    // Böylece eski mesajlar sayılmaz
                    if (roomMessages.length > 0) {
                        const lastMessage = roomMessages[0] // En yeni mesaj (zaten desc sıralı)
                        localStorage.setItem(lastOpenKey, lastMessage.created_at)
                        countsObj[roomId] = 0 // İlk açılışta badge gösterme
                    } else {
                        countsObj[roomId] = 0 // Mesaj yoksa badge yok
                    }
                } else {
                    // lastOpen varsa, sadece sonrasını say
                    const lastOpenDate = new Date(lastOpen)
                    const count = roomMessages.filter(m =>
                        new Date(m.created_at) > lastOpenDate
                    ).length || 0
                    countsObj[roomId] = count
                }
            })

            setUnreadCounts(countsObj)
        } catch (error) {
            console.error('Error fetching unread counts:', error)
        }
    }

    const fetchRooms = async () => {
        setIsLoadingRooms(true)
        try {
            // 🔒 PRIVATE ROOMS: Sadece üye olduğumuz room'ları getir
            const [
                { data: roomDeletions },
                { data: userMemberships }
            ] = await Promise.all([
                supabase.from('room_deletions').select('room_id').eq('user_id', session.user.id),
                supabase.from('room_members').select('room_id').eq('user_id', session.user.id)
            ])

            const deletedRoomIds = new Set(roomDeletions?.map(d => d.room_id) || [])
            const memberRoomIds = Array.from(userMemberships?.map(m => m.room_id) || [])

            if (memberRoomIds.length === 0) {
                setRooms([])
                return
            }

            // Üye olduğumuz tüm room'ları çek (private + dm)
            const [
                { data: allRoomsData },
                { data: allMembers }
            ] = await Promise.all([
                supabase
                    .from('rooms')
                    .select('*')
                    .in('id', memberRoomIds)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('room_members')
                    .select('room_id, user_id')
                    .in('room_id', memberRoomIds)
            ])

            const visibleRooms = (allRoomsData || []).filter(room => !deletedRoomIds.has(room.id))

            // Room'ları tipine göre ayır
            const privateRooms = []
            const dmRooms = []

            // 🚀 PERFORMANS: Benzersiz kullanıcı ID'lerini topla (DM'ler için)
            const allUserIds = new Set(
                allMembers
                    ?.map(m => m.user_id)
                    .filter(id => id !== session.user.id) || []
            )

            // Cache'de olmayanları belirle
            const uncachedUserIds = Array.from(allUserIds).filter(id => !userCacheRef.current.has(id))

            // Sadece cache'de olmayanları fetch et
            if (uncachedUserIds.length > 0) {
                const { data: allUsers } = await supabase
                    .from('users')
                    .select('id, username, email, user_code, avatar_url')
                    .in('id', uncachedUserIds)

                cacheUsers(allUsers)
            }

            const userMap = userCacheRef.current

            // Room'ları işle
            visibleRooms.forEach(room => {
                if (room.type === 'private') {
                    // Private room - grup sohbeti
                    privateRooms.push({
                        ...room,
                        isMember: true, // Zaten üyeyiz (fetch ettiğimiz için)
                        isOwner: room.created_by === session.user.id
                    })
                } else if (room.type === 'dm') {
                    // DM - diğer kullanıcıyı bul
                    const roomMembers = allMembers?.filter(m => m.room_id === room.id) || []
                    const otherUserId = roomMembers.find(m => m.user_id !== session.user.id)?.user_id

                    dmRooms.push({
                        ...room,
                        otherUser: otherUserId ? userMap.get(otherUserId) : null,
                        isMember: true
                    })
                }
            })

            const allRooms = [...privateRooms, ...dmRooms]
            setRooms(allRooms)

            // 📬 Unread counts'ları da getir
            fetchUnreadCounts()

            // 💬 Son mesajları getir
            fetchLastMessages(memberRoomIds)
        } catch (error) {
            console.error('Error in fetchRooms:', error)
            setRooms([])
        } finally {
            setIsLoadingRooms(false)
        }
    }

    // 🆔 USER CODE: Kendi kullanıcı bilgilerimizi çek (code dahil)
    const fetchCurrentUser = async () => {
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
    }

    // 👥 FRIENDS: Arkadaşları getir
    const fetchFriends = async () => {
        const { data, error } = await supabase
            .from('friends_with_details')
            .select('*')
            .eq('user_id', session.user.id)

        if (error) {
            console.error('Error fetching friends:', error)
        } else {
            setFriends(data || [])
        }
    }

    // 👥 FRIENDS: Bekleyen friend requests
    const fetchFriendRequests = async () => {
        const { data, error } = await supabase
            .from('pending_friend_requests_with_details')
            .select('*')
            .eq('receiver_id', session.user.id)

        if (error) {
            console.error('Error fetching friend requests:', error)
        } else {
            setFriendRequests(data || [])
        }
    }

    // 👥 FRIENDS: Code ile arkadaş ekle
    const addFriendByCode = async () => {
        const code = parseInt(friendCode)
        if (!code || friendCode.length !== 7) {
            alert('Geçerli bir 7 haneli kod girin!')
            return
        }

        const { data, error } = await supabase
            .rpc('send_friend_request_by_code', { target_code: code })

        if (error) {
            console.error('Error sending friend request:', error)
            alert('Hata oluştu!')
        } else if (data.success) {
            alert('✅ Arkadaşlık isteği gönderildi!')
            setShowAddFriendModal(false)
            setFriendCode('')
        } else {
            // Hata mesajları
            if (data.error === 'User not found') {
                alert('❌ Bu kod ile kullanıcı bulunamadı!')
            } else if (data.error === 'Cannot add yourself') {
                alert('❌ Kendinizi ekleyemezsiniz!')
            } else if (data.error === 'Already friends') {
                alert('ℹ️ Zaten arkadaşsınız!')
            } else if (data.error === 'Request already sent') {
                alert('ℹ️ Zaten istek gönderilmiş!')
            } else {
                alert('❌ ' + data.error)
            }
        }
    }

    // 👥 FRIENDS: İsteği kabul et
    const acceptFriendRequest = async (requestId) => {
        const { error } = await supabase
            .from('friend_requests')
            .update({ status: 'accepted' })
            .eq('id', requestId)
            .eq('receiver_id', session.user.id)

        if (error) {
            console.error('Error accepting friend request:', error)
            showToast('Hata oluştu!', 'error')
        } else {
            fetchFriendRequests() // Realtime yapacak ama yine de
            fetchFriends() // Arkadaş listesini yenile
            showToast('Arkadaşlık isteği kabul edildi!', 'success')
        }
    }

    // 👥 FRIENDS: İsteği reddet
    const rejectFriendRequest = async (requestId) => {
        const { error } = await supabase
            .from('friend_requests')
            .update({ status: 'rejected' })
            .eq('id', requestId)
            .eq('receiver_id', session.user.id)

        if (error) {
            console.error('Error rejecting friend request:', error)
            showToast('Hata oluştu!', 'error')
        } else {
            fetchFriendRequests()
            showToast('Arkadaşlık isteği reddedildi.', 'info')
        }
    }

    const fetchUsers = async () => {
        const { data, error } = await supabase
            .from('users')
            .select('id, username, email, user_code, avatar_url, created_at')
            .neq('id', session.user.id)

        if (error) {
            console.error('Error fetching users:', error)
            console.error('Error details:', JSON.stringify(error, null, 2))
        } else {
            // 🚀 PERFORMANS: Kullanıcıları cache'e ekle
            cacheUsers(data)
            setUsers(data || [])
        }
    }

    // 🎯 INVITATION SYSTEM: Davetleri getir
    const fetchPendingInvitations = async () => {
        const { data, error } = await supabase
            .from('pending_invitations_with_details')
            .select('*')
            .eq('invitee_id', session.user.id)

        if (error) {
            console.error('Error fetching invitations:', error)
        } else {
            setPendingInvitations(data || [])
        }
    }

    // 🎯 INVITATION SYSTEM: Davet gönder
    const sendInvitation = async (inviteeId) => {
        if (!currentRoom) return

        // Oda sahibi kontrolü
        if (currentRoom.created_by !== session.user.id) {
            alert('Sadece oda sahibi davet gönderebilir!')
            return
        }

        const { error } = await supabase
            .from('room_invitations')
            .insert({
                room_id: currentRoom.id,
                inviter_id: session.user.id,
                invitee_id: inviteeId,
                status: 'pending'
            })

        if (error) {
            if (error.code === '23505') { // Unique constraint violation
                alert('Bu kullanıcıya zaten davet gönderilmiş!')
            } else {
                console.error('Error sending invitation:', error)
                showToast('Davet gönderilirken hata oluştu!', 'error')
            }
        } else {
            showToast('Davet başarıyla gönderildi!', 'success')
            setShowInviteModal(false)
        }
    }

    // 🎯 INVITATION SYSTEM: Daveti kabul et
    const acceptInvitation = async (invitationId) => {
        const { error } = await supabase
            .from('room_invitations')
            .update({ status: 'accepted' })
            .eq('id', invitationId)
            .eq('invitee_id', session.user.id)

        if (error) {
            console.error('Error accepting invitation:', error)
            showToast('Davet kabul edilirken hata oluştu!', 'error')
        } else {
            // Davetleri yenile (realtime listener otomatik yapacak ama yine de)
            fetchPendingInvitations()
            // Odaları yenile (yeni üye olduğumuz oda görecek)
            debouncedFetchRooms() // ⚡ PERFORMANS: Debounced
            // Panel'i kapat
            setShowInvitationsPanel(false)
            showToast('Davet kabul edildi! Odaya katıldınız.', 'success')
        }
    }

    // 🎯 INVITATION SYSTEM: Daveti reddet
    const rejectInvitation = async (invitationId) => {
        const { error } = await supabase
            .from('room_invitations')
            .update({ status: 'rejected' })
            .eq('id', invitationId)
            .eq('invitee_id', session.user.id)

        if (error) {
            console.error('Error rejecting invitation:', error)
            alert('Davet reddedilirken hata oluştu!')
        } else {
            // Davetleri yenile (realtime listener otomatik yapacak ama yine de)
            fetchPendingInvitations()
            alert('❌ Davet reddedildi.')
        }
    }

    const fetchMessages = async (roomId, isInitial = true) => {
        if (isInitial) {
            setIsLoadingMessages(true)
            setMessages([])
            setOldestMessageId(null)
            setHasMoreMessages(false)
        }

        try {
            // PARALEL: Messages ve deletions'ı aynı anda çek
            const [
                { data, error },
                { data: deletions }
            ] = await Promise.all([
                // 📄 PAGINATION: Son N mesajı çek (en yeni -> en eski sıralı)
                supabase
                    .from('messages')
                    .select('*')
                    .eq('room_id', roomId)
                    .order('created_at', { ascending: false })
                    .limit(MESSAGE_LIMIT + 1), // +1 ile daha fazla mesaj var mı kontrol et
                supabase
                    .from('message_deletions')
                    .select('message_id')
                    .eq('user_id', session.user.id)
            ])

            if (error) {
                console.error('Error fetching messages:', error)
                return
            }

            // Daha fazla mesaj var mı kontrol et
            const hasMore = data && data.length > MESSAGE_LIMIT
            setHasMoreMessages(hasMore)

            // Fazla mesajı çıkar
            const messagesToShow = hasMore ? data.slice(0, MESSAGE_LIMIT) : data || []

            // En eski mesajın ID'sini kaydet (daha fazla yüklemek için)
            if (messagesToShow.length > 0) {
                setOldestMessageId(messagesToShow[messagesToShow.length - 1].id)
            }

            const deletedMessageIds = new Set(deletions?.map(d => d.message_id) || [])

            // Filter out messages that the current user has deleted
            const visibleMessages = messagesToShow.filter(msg => !deletedMessageIds.has(msg.id))

            // 🚀 PERFORMANS: Benzersiz kullanıcı ID'lerini bul
            const userIds = [...new Set(visibleMessages.map(m => m.user_id))]

            if (userIds.length === 0) {
                setMessages([])
                return
            }

            // Cache'de olmayanları belirle
            const uncachedUserIds = userIds.filter(id => !userCacheRef.current.has(id))

            // Sadece cache'de olmayanları fetch et
            if (uncachedUserIds.length > 0) {
                const { data: usersData } = await supabase
                    .from('users')
                    .select('id, username, email')
                    .in('id', uncachedUserIds)

                // Yeni kullanıcıları cache'e ekle
                cacheUsers(usersData)
            }

            // Tüm mesajlar için cache'den kullanıcı bilgilerini al
            const messagesWithUsers = visibleMessages.map(msg => ({
                ...msg,
                user: userCacheRef.current.get(msg.user_id)
            }))

            // Mesajları ters çevir (en eski -> en yeni)
            const sortedMessages = messagesWithUsers.reverse()
            // Duplicate'leri temizle (ID'ye göre unique yap)
            const uniqueMessages = []
            const seenIds = new Set()
            for (const msg of sortedMessages) {
                if (!seenIds.has(msg.id)) {
                    seenIds.add(msg.id)
                    uniqueMessages.push(msg)
                }
            }
            setMessages(uniqueMessages)

            // 📬 UNREAD: Mesajlar yüklendiğinde lastOpen'ı güncelle (badge'i sıfırlamak için)
            if (uniqueMessages.length > 0 && currentRoom) {
                const lastMessage = uniqueMessages[uniqueMessages.length - 1] // En yeni mesaj
                const lastOpenKey = `lastOpen_${currentRoom.id}`
                localStorage.setItem(lastOpenKey, lastMessage.created_at)
                // Badge'i sıfırla
                setUnreadCounts(prev => ({ ...prev, [currentRoom.id]: 0 }))
            }

            // 📬 UNREAD: Badge'i burada sıfırlama! 
            // Global listener (realtime) zaten yapıyor: currentRoom açıksa badge = 0
            // Burada sıfırlarsak fetchUnreadCounts() ile race condition olur
        } catch (error) {
            console.error('Error in fetchMessages:', error)
            setMessages([])
        } finally {
            setIsLoadingMessages(false)
        }
    }

    // 📄 PAGINATION: Eski mesajları yükle (yukarı scroll edildiğinde)
    const loadMoreMessages = async () => {
        if (!currentRoom || !oldestMessageId || isLoadingMoreMessages || !hasMoreMessages) {
            return Promise.resolve()
        }

        setIsLoadingMoreMessages(true)

        try {
            // Mevcut en eski mesajdan daha eski mesajları çek
            const [
                { data, error },
                { data: deletions }
            ] = await Promise.all([
                supabase
                    .from('messages')
                    .select('*')
                    .eq('room_id', currentRoom.id)
                    .lt('id', oldestMessageId) // ID'si oldestMessageId'den küçük olanlar
                    .order('created_at', { ascending: false })
                    .limit(MESSAGE_LIMIT + 1),
                supabase
                    .from('message_deletions')
                    .select('message_id')
                    .eq('user_id', session.user.id)
            ])

            if (error) {
                console.error('Error loading more messages:', error)
                return
            }

            if (!data || data.length === 0) {
                setHasMoreMessages(false)
                return
            }

            // Daha fazla mesaj var mı kontrol et
            const hasMore = data.length > MESSAGE_LIMIT
            setHasMoreMessages(hasMore)

            // Fazla mesajı çıkar
            const messagesToShow = hasMore ? data.slice(0, MESSAGE_LIMIT) : data

            // En eski mesajın ID'sini güncelle
            if (messagesToShow.length > 0) {
                setOldestMessageId(messagesToShow[messagesToShow.length - 1].id)
            }

            const deletedMessageIds = new Set(deletions?.map(d => d.message_id) || [])
            const visibleMessages = messagesToShow.filter(msg => !deletedMessageIds.has(msg.id))

            // 🚀 PERFORMANS: Kullanıcı bilgilerini cache'den al
            const userIds = [...new Set(visibleMessages.map(m => m.user_id))]
            const uncachedUserIds = userIds.filter(id => !userCacheRef.current.has(id))

            if (uncachedUserIds.length > 0) {
                const { data: usersData } = await supabase
                    .from('users')
                    .select('id, username, email')
                    .in('id', uncachedUserIds)

                cacheUsers(usersData)
            }

            const messagesWithUsers = visibleMessages.map(msg => ({
                ...msg,
                user: userCacheRef.current.get(msg.user_id)
            }))

            // Eski mesajları başa ekle (en eski -> en yeni)
            const sortedNewMessages = messagesWithUsers.reverse()
            setMessages(prevMessages => {
                // Duplicate'leri temizle (ID'ye göre unique yap)
                const combined = [...sortedNewMessages, ...prevMessages]
                const uniqueMessages = []
                const seenIds = new Set()
                // Ters sırada kontrol et (son eklenenler önce)
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
    }

    const sendMessage = async (e) => {
        e.preventDefault()

        const trimmedMessage = newMessage.trim()

        try {
            messageSchema.parse(trimmedMessage)
        } catch (err) {
            if (err instanceof z.ZodError) {
                // Hata mesajını göster (Toast varsa toast kullan, yoksa alert)
                // Şimdilik alert kullanalım veya mevcut showToast fonksiyonunu kullanalım
                showToast(err.errors[0].message, 'error')
                return
            }
            return
        }

        if (!currentRoom) return

        // Send via Socket.IO to backend, backend will save to Supabase
        // Supabase Realtime will then push the message back to frontend
        const socket = getSocket()
        socket.emit('sendMessage', {
            roomId: currentRoom.id,
            userId: session.user.id,
            content: newMessage.trim()
        })

        setNewMessage('')
    }

    const openCreateRoomModal = () => {
        setNewRoomName('')
        setSelectedFriendsForRoom([])
        setShowCreateRoomModal(true)
    }

    const handleSelectRoom = (room) => {
        // Eğer DM odası ise ve otherUser varsa, önce mevcut DM odasını kontrol et
        if ((room.type === 'dm' || room.type === 'Direkt Mesaj') && room.otherUser) {
            // Mevcut DM odasını kontrol et
            const existingDM = rooms.find(r =>
                r.type === 'dm' &&
                r.otherUser?.id === room.otherUser.id
            )

            if (existingDM) {
                // Mevcut DM odası varsa ona yönlendir
                setCurrentRoom(existingDM)
                setView('chat')
                return
            } else {
                // Yoksa yeni DM oluştur
                startDM(room.otherUser)
                setView('chat')
                return
            }
        }

        // Normal oda seçimi
        const existingRoom = rooms.find(r => r.id === room.id)
        if (existingRoom) {
            setCurrentRoom(existingRoom)
        } else {
            setCurrentRoom(room)
        }
        setView('chat')
    }

    const handleCreateGroup = async (groupName, selectedFriendIds) => {
        try {
            const { data: roomData, error: roomError } = await supabase
                .from('rooms')
                .insert([{ name: groupName, type: 'private', created_by: session.user.id }])
                .select()
                .single()

            if (roomError) {
                return { success: false, error: 'Grup oluşturulamadı!' }
            }

            if (selectedFriendIds.length > 0) {
                await new Promise(resolve => setTimeout(resolve, 200))

                const memberInserts = selectedFriendIds.map(friendId => ({
                    room_id: roomData.id,
                    user_id: friendId
                }))

                const { error: addMembersError } = await supabase
                    .from('room_members')
                    .insert(memberInserts)
                    .select()

                if (addMembersError && addMembersError.code !== '23505') {
                    console.error('Error adding friends to room:', addMembersError)
                }
            }

            const roomWithMembership = {
                ...roomData,
                isMember: true,
                isOwner: true
            }
            setRooms([roomWithMembership, ...rooms])
            setCurrentRoom(roomWithMembership)
            setView('chat')

            showToast(`"${groupName}" grubu oluşturuldu!`, 'success')
            return { success: true }
        } catch (error) {
            console.error('Error creating group:', error)
            return { success: false, error: 'Grup oluşturulamadı!' }
        }
    }

    const handleAddFriend = async (code) => {
        try {
            const { data, error } = await supabase
                .rpc('send_friend_request_by_code', { target_code: code })

            if (error) {
                return { success: false, error: 'Hata oluştu!' }
            } else if (data && data.success) {
                showToast('Arkadaşlık isteği gönderildi!', 'success')
                return { success: true }
            } else {
                const errorMsg = data?.error || 'Hata oluştu!'
                // Türkçe hata mesajları
                if (errorMsg === 'User not found') {
                    return { success: false, error: 'Bu kod ile kullanıcı bulunamadı!' }
                } else if (errorMsg === 'Cannot add yourself') {
                    return { success: false, error: 'Kendinizi ekleyemezsiniz!' }
                } else if (errorMsg === 'Already friends') {
                    return { success: false, error: 'Zaten arkadaşsınız!' }
                } else if (errorMsg === 'Request already sent') {
                    return { success: false, error: 'Zaten istek gönderilmiş!' }
                }
                return { success: false, error: errorMsg }
            }
        } catch (error) {
            console.error('Error adding friend:', error)
            return { success: false, error: 'Hata oluştu!' }
        }
    }

    const createRoom = async () => {
        if (!newRoomName?.trim()) {
            alert('Grup adı boş olamaz!')
            return
        }

        // 🔒 PRIVATE ROOMS: Artık private grup olarak oluşturuyoruz
        const { data: roomData, error: roomError } = await supabase
            .from('rooms')
            .insert([{ name: newRoomName.trim(), type: 'private', created_by: session.user.id }])
            .select()
            .single()

        if (roomError) {
            console.error('Error creating room:', roomError)
            alert('Grup oluşturulamadı!')
            return
        }

        // ⚠️ Trigger otomatik owner'ı ekler, manuel eklemeye gerek yok!
        // Sadece seçilen arkadaşları ekle
        if (selectedFriendsForRoom.length > 0) {
            // Küçük bir delay ekleyelim ki trigger çalışsın
            await new Promise(resolve => setTimeout(resolve, 200))

            const memberInserts = selectedFriendsForRoom.map(friendId => ({
                room_id: roomData.id,
                user_id: friendId
            }))

            const { error: addMembersError } = await supabase
                .from('room_members')
                .insert(memberInserts)
                .select() // 409 hatası için workaround

            if (addMembersError) {
                // Duplicate key hatası ignore, diğerleri console'a
                if (addMembersError.code !== '23505') {
                    console.error('Error adding friends to room:', addMembersError)
                }
                // Kullanıcıya sadece kritik hatalar göster
                if (addMembersError.code && !['23505', '42P01'].includes(addMembersError.code)) {
                    alert(`⚠️ Bazı arkadaşlar eklenemedi`)
                }
            }
        }

        const roomWithMembership = {
            ...roomData,
            isMember: true,
            isOwner: true
        }
        setRooms([roomWithMembership, ...rooms])
        setCurrentRoom(roomWithMembership)

        // Modal'ı kapat
        setShowCreateRoomModal(false)
        setNewRoomName('')
        setSelectedFriendsForRoom([])

        const memberCount = selectedFriendsForRoom.length
        showToast(
            `"${newRoomName}" grubu oluşturuldu!${memberCount > 0 ? ` ${memberCount} arkadaş eklendi.` : ''}`,
            'success'
        )
    }

    const toggleFriendSelection = (friendId) => {
        setSelectedFriendsForRoom(prev =>
            prev.includes(friendId)
                ? prev.filter(id => id !== friendId)
                : [...prev, friendId]
        )
    }

    const joinRoom = async (room) => {
        // Check if already a member
        if (room.isMember) {
            setCurrentRoom(room)
            return
        }

        // Add user as member
        const { error: memberError } = await supabase
            .from('room_members')
            .insert([{ room_id: room.id, user_id: session.user.id }])

        if (memberError) {
            console.error('Error joining room:', memberError)
            alert('Odaya katılırken hata oluştu')
            return
        }

        // Update room list
        const updatedRoom = { ...room, isMember: true }
        setRooms(prevRooms => prevRooms.map(r => r.id === room.id ? updatedRoom : r))
        setCurrentRoom(updatedRoom)
    }

    const deleteRoom = async (roomId, e) => {
        e.stopPropagation()
        if (!confirm('Bu odayı silmek istediğinize emin misiniz? (Sadece sizin görünümünüzden silinecek)')) return

        // Get the room to find its members
        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('id, type')
            .eq('id', roomId)
            .single()

        if (roomError || !room) {
            console.error('Error fetching room:', roomError)
            alert('Oda bulunamadı')
            return
        }

        // Check if deletion record already exists
        const { data: existingDeletion, error: existingDeletionError } = await supabase
            .from('room_deletions')
            .select('id')
            .eq('room_id', roomId)
            .eq('user_id', session.user.id)
            .maybeSingle()

        if (existingDeletionError) {
            console.error('Error checking existing room deletion:', existingDeletionError)
        }

        // Only insert if deletion record doesn't exist
        if (!existingDeletion) {
            const { error: deletionError } = await supabase
                .from('room_deletions')
                .insert([{
                    room_id: roomId,
                    user_id: session.user.id
                }])

            if (deletionError) {
                console.error('Error deleting room:', deletionError)
                alert('Oda silinirken bir hata oluştu: ' + deletionError.message)
                return
            }
        }

        // Remove room from UI immediately
        setRooms(prevRooms => prevRooms.filter(r => r.id !== roomId))
        if (currentRoom?.id === roomId) {
            setCurrentRoom(null)
        }

        // Kalıcı silme backend trigger'ında otomatik olacak
    }

    const startDM = async (otherUser) => {
        // Mevcut DM odalarını rooms state'inden kontrol et (daha hızlı)
        const existingDM = rooms.find(r =>
            r.type === 'dm' &&
            r.otherUser?.id === otherUser.id
        )

        if (existingDM) {
            // Mevcut oda var, direk aç
            setCurrentRoom(existingDM)
            setActiveTab('rooms')
            return
        }

        // Yeni DM oluştur
        const dmName = `DM: ${otherUser.username || otherUser.id.slice(0, 8)}`

        const { data: newRoom, error: roomError } = await supabase
            .from('rooms')
            .insert([{ name: dmName, type: 'dm', created_by: session.user.id }])
            .select()
            .single()

        if (roomError) {
            console.error('Error creating DM room:', roomError)
            alert(`DM oda oluşturulamadı: ${roomError.message}`)
            return
        }

        const { error: membersError } = await supabase
            .from('room_members')
            .insert([
                { room_id: newRoom.id, user_id: session.user.id },
                { room_id: newRoom.id, user_id: otherUser.id }
            ])

        if (membersError) {
            console.error('Error adding members:', membersError)
            return
        }

        // 🔔 Realtime listener otomatik olarak fetchRooms() çağıracak
        // Ama biz hemen odayı açmak istiyoruz, o yüzden manuel ekliyoruz
        const roomWithOtherUser = { ...newRoom, otherUser, isMember: true }
        setCurrentRoom(roomWithOtherUser)
        setActiveTab('rooms')

        // Realtime listener ile rooms listesi güncellencek (duplicate önlemek için kontrol var)
        // fetchRooms() çağrılacak ve tüm liste yenilenecek
    }

    const deleteMessage = async (messageId) => {
        // Onay ChatWindow'da yapılıyor, burada direkt sil

        // First, get the message to find its room
        const { data: message, error: messageError } = await supabase
            .from('messages')
            .select('room_id, user_id')
            .eq('id', messageId)
            .single()

        if (messageError || !message) {
            console.error('Error fetching message:', messageError)
            alert('Mesaj bulunamadı')
            return
        }

        // Check if deletion record already exists
        const { data: existingDeletion, error: existingDeletionError } = await supabase
            .from('message_deletions')
            .select('id')
            .eq('message_id', messageId)
            .eq('user_id', session.user.id)
            .maybeSingle()

        if (existingDeletionError) {
            console.error('Error checking existing deletion:', existingDeletionError)
        }

        // Only insert if deletion record doesn't exist
        if (!existingDeletion) {
            const { error: deletionError } = await supabase
                .from('message_deletions')
                .insert([{
                    message_id: messageId,
                    user_id: session.user.id
                }])

            if (deletionError) {
                console.error('Error deleting message:', deletionError)
                alert('Mesaj silinirken bir hata oluştu: ' + deletionError.message)
                return
            }
        }

        // Remove message from UI immediately
        setMessages((prev) => prev.filter(msg => msg.id !== messageId))

        // Backend'de kontrol edilecek - burada sadece UI'dan kaldır
    }

    // ⚡ PERFORMANS: Scroll yönetimi artık ChatWindow içinde yapılıyor

    const handleLogout = async () => {
        // Socket bağlantısını kapat
        disconnectSocket()
        await supabase.auth.signOut()
    }

    // ⚡ PERFORMANS: useCallback ile memoize
    const getRoomDisplayName = useCallback((room) => {
        if (room.type === 'dm') {
            // DM odaları için sadece diğer kullanıcının ismini göster
            if (room.otherUser) {
                return room.otherUser.username || room.otherUser.email?.split('@')[0] || 'Unknown User'
            }
            // Fallback: oda isminden al
            const name = room.name.replace(/^DM:\s*/, '')
            return name || 'Unknown User'
        }
        return room.name
    }, [])

    return (
        <>
            {/* 🔔 TOAST: Bildirim */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-[100] animate-slide-up">
                    <div className={`rounded-lg shadow-2xl px-6 py-4 flex items-center gap-3 min-w-[300px] max-w-md border-2 ${toast.type === 'success'
                        ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-500 text-green-800'
                        : toast.type === 'error'
                            ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-500 text-red-800'
                            : 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-500 text-blue-800'
                        }`}>
                        <div className="text-2xl">
                            {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
                        </div>
                        <div className="flex-1">
                            <p className="font-medium text-sm">{toast.message}</p>
                        </div>
                        <button
                            onClick={() => setToast(null)}
                            className="text-gray-500 hover:text-gray-700 text-xl leading-none"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            {/* 🎯 INVITATION SYSTEM: Davet Gönderme Modal */}
            {showInviteModal && currentRoom && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowInviteModal(false)}>
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800">Üye Davet Et</h3>
                            <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                            <strong>{currentRoom.name}</strong> odasına davet göndermek istediğiniz kullanıcıyı seçin:
                        </p>
                        <div className="max-h-96 overflow-y-auto space-y-2">
                            {users.length === 0 ? (
                                <p className="text-center text-gray-500 py-4">Davet edilecek kullanıcı yok</p>
                            ) : (
                                users
                                    .filter(user => !rooms.find(r => r.id === currentRoom.id)?.members?.includes(user.id))
                                    .map(user => (
                                        <div key={user.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg border border-gray-200">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                                                    {(user.username || user.email || 'U')[0].toUpperCase()}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium text-gray-900">{user.username || user.email}</p>
                                                        {/* 🆔 USER CODE */}
                                                        {user.user_code && (
                                                            <span className="text-xs text-gray-400 font-mono">#{user.user_code}</span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-500">{user.email}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => sendInvitation(user.id)}
                                                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                                            >
                                                Davet Gönder
                                            </button>
                                        </div>
                                    ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 🔔 BİLDİRİMLER: Birleşik Panel (Room + Friend Invitations) */}
            {showInvitationsPanel && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowInvitationsPanel(false)}>
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pb-2 border-b">
                            <h3 className="text-lg font-bold text-gray-800">🔔 Bildirimlerim</h3>
                            <button onClick={() => setShowInvitationsPanel(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                        </div>

                        {/* Bildirim yoksa */}
                        {pendingInvitations.length === 0 && friendRequests.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-6xl mb-4">📭</p>
                                <p className="text-gray-500">Bildiriminiz yok</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* 👥 FRIEND REQUESTS - Önce arkadaşlık istekleri */}
                                {friendRequests.length > 0 && (
                                    <div>
                                        <h4 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            Arkadaşlık İstekleri
                                            <span className="bg-sky-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                                                {friendRequests.length}
                                            </span>
                                        </h4>
                                        <div className="space-y-3">
                                            {friendRequests.map(req => (
                                                <div key={`req-${req.id}`} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                                                    <div className="flex items-center gap-4 mb-4">
                                                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-sky-400 to-indigo-500 p-0.5">
                                                            <div className="w-full h-full bg-white dark:bg-slate-900 rounded-full flex items-center justify-center overflow-hidden">
                                                                <img
                                                                    src={req.sender_avatar || `https://ui-avatars.com/api/?name=${req.sender_username || req.sender_email}`}
                                                                    className="w-full h-full object-cover"
                                                                    alt="Avatar"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-bold text-slate-800 dark:text-white truncate">
                                                                {req.sender_username || req.sender_email}
                                                            </p>
                                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">
                                                                Yeni arkadaş isteği
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => acceptFriendRequest(req.id)}
                                                            className="flex-1 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-sky-100 dark:shadow-none"
                                                        >
                                                            Kabul Et
                                                        </button>
                                                        <button
                                                            onClick={() => rejectFriendRequest(req.id)}
                                                            className="flex-1 py-2 bg-gray-100 dark:bg-slate-700 text-slate-700 dark:text-gray-300 rounded-xl font-bold text-xs hover:bg-gray-200 dark:hover:bg-slate-600 transition-all"
                                                        >
                                                            Reddet
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* 🏠 ROOM INVITATIONS */}
                                {pendingInvitations.length > 0 && (
                                    <div>
                                        <h4 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            Oda Davetleri
                                            <span className="bg-purple-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                                                {pendingInvitations.length}
                                            </span>
                                        </h4>
                                        <div className="space-y-3">
                                            {pendingInvitations.map(invite => (
                                                <div key={`room-${invite.id}`} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                                                    <div className="flex items-center gap-4 mb-4">
                                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-400 to-pink-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-purple-100 dark:shadow-none">
                                                            {(invite.room_name || '?')[0].toUpperCase()}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-bold text-slate-800 dark:text-white truncate">{invite.room_name}</p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                <span className="font-bold text-purple-500">{invite.inviter_username || invite.inviter_email}</span> davet etti
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => acceptInvitation(invite.id)}
                                                            className="flex-1 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-purple-100 dark:shadow-none"
                                                        >
                                                            Katıl
                                                        </button>
                                                        <button
                                                            onClick={() => rejectInvitation(invite.id)}
                                                            className="flex-1 py-2 bg-gray-100 dark:bg-slate-700 text-slate-700 dark:text-gray-300 rounded-xl font-bold text-xs hover:bg-gray-200 dark:hover:bg-slate-600 transition-all"
                                                        >
                                                            Reddet
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}



            <div className={`flex h-screen w-full bg-white dark:bg-slate-900 overflow-hidden relative transition-colors`}>
                {/* Sidebar */}
                <div className={`${view === 'sidebar' ? 'flex' : 'hidden'} md:flex w-full md:w-[320px] shrink-0 border-r border-gray-100 dark:border-slate-800 transition-colors`}>
                    <Sidebar
                        rooms={rooms.map(room => ({
                            id: room.id,
                            name: getRoomDisplayName(room),
                            type: room.type === 'private' ? 'Grup' : 'Direkt Mesaj',
                            status: room.type === 'dm' && room.otherUser?.online ? 'Online' : undefined,
                            role: room.isOwner ? 'Sahip' : undefined,
                            ...room
                        }))}
                        friends={friends}
                        selectedRoomId={currentRoom?.id}
                        onSelectRoom={handleSelectRoom}
                        onCreateGroupClick={() => setShowCreateRoomModal(true)}
                        onAddFriendClick={() => {
                            setShowAddFriendModal(true)
                            setShowInvitationsPanel(false)
                        }}
                        onNotificationsClick={() => {
                            setShowInvitationsPanel(!showInvitationsPanel)
                        }}
                        onDeleteRoom={(roomId) => {
                            if (confirm('Bu odayı silmek istediğinize emin misiniz? (Sadece sizin görünümünüzden silinecek)')) {
                                deleteRoom(roomId, { stopPropagation: () => { } })
                            }
                        }}
                        currentUser={currentUser}
                        onLogout={handleLogout}
                        unreadCounts={unreadCounts}
                        pendingInvitationsCount={pendingInvitations.length}
                        friendRequestsCount={friendRequests.length}
                        lastMessages={lastMessages}
                        session={session}
                        userPresence={userPresence}
                        darkMode={darkMode}
                        onToggleDarkMode={onToggleDarkMode}
                    />
                </div>

                {/* ChatWindow */}
                <div className={`${view === 'chat' ? 'flex' : 'hidden'} md:flex flex-1 h-full`}>
                    {currentRoom ? (
                        <ChatWindow
                            selectedRoom={currentRoom}
                            messages={messages.map(msg => ({
                                id: msg.id,
                                text: msg.content,
                                sender: msg.user_id === session.user.id ? 'me' : 'other',
                                timestamp: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
                                avatar: msg.user?.avatar_url,
                                user_id: msg.user_id,
                                user: msg.user,
                                created_at: msg.created_at,
                                content: msg.content,
                                file_url: msg.file_url,
                                message_type: msg.message_type,
                                file_name: msg.file_name,
                                file_size: msg.file_size,
                                status: msg.status // ✅ Status field eklendi!
                            }))}
                            onSendMessage={(text, fileUrl, messageType, fileName, fileSize) => {
                                const socket = getSocket()
                                socket.emit('sendMessage', {
                                    roomId: currentRoom.id,
                                    userId: session.user.id,
                                    content: text,
                                    fileUrl: fileUrl,
                                    messageType: messageType,
                                    fileName: fileName,
                                    fileSize: fileSize
                                })
                            }}
                            onBack={() => setView('sidebar')}
                            isLoadingMessages={isLoadingMessages}
                            isLoadingMoreMessages={isLoadingMoreMessages}
                            hasMoreMessages={hasMoreMessages}
                            onInviteClick={() => {
                                if (users.length === 0) {
                                    fetchUsers()
                                }
                                setShowInviteModal(true)
                            }}
                            onDeleteMessage={deleteMessage}
                            onLoadMoreMessages={loadMoreMessages}
                            session={session}
                            userPresence={userPresence}
                            lastMessages={lastMessages}
                            currentUser={currentUser}
                            darkMode={darkMode}
                        />
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-900 transition-colors">
                            <div className="text-center">
                                <div className="text-6xl mb-4">💬</div>
                                <p className="text-lg font-bold text-slate-800 dark:text-gray-200">Bir oda seçin veya sohbete başlayın</p>
                                <p className="text-sm mt-2 font-medium">Odalar veya Arkadaşlar sekmesinden seçim yapın</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modals */}
                {showCreateRoomModal && (
                    <CreateGroupModal
                        friends={friends}
                        onClose={() => setShowCreateRoomModal(false)}
                        onCreateGroup={handleCreateGroup}
                    />
                )}

                {showAddFriendModal && (
                    <AddFriendModal
                        onClose={() => setShowAddFriendModal(false)}
                        onAddFriend={handleAddFriend}
                    />
                )}
            </div>
        </>
    )
}
