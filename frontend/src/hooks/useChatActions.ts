import { useCallback } from 'react'
import { z } from 'zod'
import DOMPurify from 'dompurify'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'
import { getSocket, disconnectSocket } from '../socket'
import { Room, User, Message } from '../types'

// XSS kontrolü yapan fonksiyon
export const containsXSS = (msg: string) => {
    const clean = DOMPurify.sanitize(msg)
    return clean.trim() !== msg.trim()
}

export const messageSchema = z.string()
    .min(1, "Mesaj boş olamaz")
    .max(2000, "Mesaj çok uzun")
    .refine(msg => !containsXSS(msg), { message: "Geçersiz içerik (HTML veya Script içeremez)" })

import { useChatState } from './useChatState'
import { useChatData } from './useChatData'

type ChatState = ReturnType<typeof useChatState>
type ChatDataFunctions = ReturnType<typeof useChatData>

/**
 * Chat action fonksiyonları için custom hook
 * Kullanıcı etkileşimlerini içerir
 */
export function useChatActions(session: Session, state: ChatState, dataFunctions: ChatDataFunctions) {
    const {
        rooms, setRooms,
        currentRoom, setCurrentRoom,
        setMessages,
        newMessage, setNewMessage,
        setShowInviteModal, setShowInvitationsPanel,
        setShowCreateRoomModal,
        setNewRoomName, setSelectedFriendsForRoom,
        setActiveTab, setView,
        showToast, deletedMessageIdsRef,
        setCurrentUser, userCacheRef, setUsers
    } = state

    const {
        debouncedFetchRooms,
        fetchFriendRequests, fetchFriends,
        fetchPendingInvitations, fetchUsers
    } = dataFunctions

    // Mesaj gönder
    const sendMessage = useCallback(async (e?: React.FormEvent) => {
        e?.preventDefault?.()

        const trimmedMessage = newMessage.trim()

        try {
            messageSchema.parse(trimmedMessage)
        } catch {
            // Zod hatası değilse atla
            return
        }

        if (!currentRoom) return

        let targetRoomId = currentRoom.id

        // Handle provisional room creation
        if (currentRoom.is_provisional && currentRoom.otherUser) {
            const dmName = `DM: ${currentRoom.otherUser.username || currentRoom.otherUser.id.slice(0, 8)}`

            // Create the room
            const { data: newRoom, error: roomError } = await supabase
                .from('rooms')
                .insert([{ name: dmName, type: 'dm', created_by: session.user.id }])
                .select()
                .single()

            if (roomError) {
                console.error('Error creating DM room:', roomError)
                showToast('Mesaj gönderilemedi (Oda oluşturma hatası)', 'error')
                return
            }

            // Add members
            const { error: membersError } = await supabase
                .from('room_members')
                .insert([
                    { room_id: newRoom.id, user_id: session.user.id },
                    { room_id: newRoom.id, user_id: currentRoom.otherUser.id }
                ])

            if (membersError) {
                console.error('Error adding members:', membersError)
                return
            }

            targetRoomId = newRoom.id

            // Update local state to reflect real room
            const realRoom = {
                ...newRoom,
                otherUser: currentRoom.otherUser,
                isMember: true
            }

            // Update rooms list
            setRooms((prev: Room[]) => [realRoom, ...prev])
            // Update current room
            setCurrentRoom(realRoom)
        }

        const socket = getSocket()
        socket.emit('sendMessage', {
            roomId: targetRoomId,
            userId: session.user.id,
            content: newMessage.trim()
        })

        setNewMessage('')
    }, [newMessage, currentRoom, session.user.id, setNewMessage, setRooms, setCurrentRoom, showToast])

    // Generic Message Send Handler (used by ChatWindow)
    const handleSendMessage = useCallback(async (content: string, fileUrl: string | null, messageType: string, fileName: string | null, fileSize: number | null) => {
        if (!currentRoom) return

        let targetRoomId = currentRoom.id

        // Handle provisional room creation
        if (currentRoom.is_provisional && currentRoom.otherUser) {
            const dmName = `DM: ${currentRoom.otherUser.username || currentRoom.otherUser.id.slice(0, 8)}`

            // Create the room
            const { data: newRoom, error: roomError } = await supabase
                .from('rooms')
                .insert([{ name: dmName, type: 'dm', created_by: session.user.id }])
                .select()
                .single()

            if (roomError) {
                console.error('Error creating DM room:', roomError)
                showToast('Mesaj gönderilemedi (Oda oluşturma hatası)', 'error')
                return
            }

            // Add members
            const { error: membersError } = await supabase
                .from('room_members')
                .insert([
                    { room_id: newRoom.id, user_id: session.user.id },
                    { room_id: newRoom.id, user_id: currentRoom.otherUser.id }
                ])

            if (membersError) {
                console.error('Error adding members:', membersError)
                return
            }

            targetRoomId = newRoom.id

            // Update local state to reflect real room
            const realRoom = {
                ...newRoom,
                otherUser: currentRoom.otherUser,
                isMember: true
            }

            // Update rooms list
            setRooms((prev: Room[]) => [realRoom, ...prev])
            // Update current room
            setCurrentRoom(realRoom)
        }

        const socket = getSocket()
        socket.emit('sendMessage', {
            roomId: targetRoomId,
            userId: session.user.id,
            content,
            fileUrl,
            messageType,
            fileName,
            fileSize
        })
    }, [currentRoom, session.user.id, setRooms, setCurrentRoom, showToast])

    // Oda seç - startDM inline olarak kullanılıyor
    const handleSelectRoom = useCallback(async (room: Room) => {
        if (room.type === 'dm' && room.otherUser) {
            const existingDM = rooms.find((r: Room) =>
                r.type === 'dm' &&
                r.otherUser?.id === room.otherUser!.id
            )

            if (existingDM) {
                setCurrentRoom(existingDM)
                setView('chat')
                return
            } else {
                // Inline DM creation - PROVISIONAL
                // Don't create in DB until message sent
                const tempRoom: Room = {
                    id: `temp-${room.otherUser.id}`,
                    name: room.otherUser.username,
                    type: 'dm',
                    created_by: session.user.id,
                    created_at: new Date().toISOString(),
                    otherUser: room.otherUser,
                    is_provisional: true
                }

                setCurrentRoom(tempRoom)
                setView('chat')
                return
            }
        }

        const existingRoom = rooms.find((r: Room) => r.id === room.id)
        if (existingRoom) {
            setCurrentRoom(existingRoom)
        } else {
            setCurrentRoom(room)
        }
        setView('chat')
    }, [rooms, setCurrentRoom, setView, session.user.id])

    // DM başlat
    const startDM = useCallback(async (otherUser: User) => {
        const existingDM = rooms.find((r: Room) =>
            r.type === 'dm' &&
            r.otherUser?.id === otherUser.id
        )

        if (existingDM) {
            setCurrentRoom(existingDM)
            setActiveTab('rooms')
            return
        }

        // PROVISIONAL ROOM CREATION
        const tempRoom: Room = {
            id: `temp-${otherUser.id}`,
            name: otherUser.username,
            type: 'dm',
            created_by: session.user.id,
            created_at: new Date().toISOString(),
            otherUser: otherUser,
            is_provisional: true
        }

        setCurrentRoom(tempRoom)
        setActiveTab('rooms')
    }, [rooms, session.user.id, setCurrentRoom, setActiveTab])

    // Grup oluştur
    const handleCreateGroup = useCallback(async (groupName: string, selectedFriendIds: string[]) => {
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
            setRooms((prev: Room[]) => [roomWithMembership, ...prev])
            setCurrentRoom(roomWithMembership)
            setView('chat')

            showToast(`"${groupName}" grubu oluşturuldu!`, 'success')
            return { success: true }
        } catch (error) {
            console.error('Error creating group:', error)
            return { success: false, error: 'Grup oluşturulamadı!' }
        }
    }, [session.user.id, setRooms, setCurrentRoom, setView, showToast])

    // Odaya katıl
    const joinRoom = useCallback(async (room: Room & { isMember?: boolean }) => {
        if (room.isMember) {
            setCurrentRoom(room)
            return
        }

        const { error: memberError } = await supabase
            .from('room_members')
            .insert([{ room_id: room.id, user_id: session.user.id }])

        if (memberError) {
            console.error('Error joining room:', memberError)
            showToast('Odaya katılırken hata oluştu', 'error')
            return
        }

        const updatedRoom = { ...room, isMember: true }
        setRooms((prevRooms: Room[]) => prevRooms.map(r => r.id === room.id ? updatedRoom : r))
        setCurrentRoom(updatedRoom)
    }, [session.user.id, setRooms, setCurrentRoom, showToast])

    // Oda sil
    const deleteRoom = useCallback(async (roomId: string, e?: React.MouseEvent) => {
        e?.stopPropagation?.()

        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('id, type')
            .eq('id', roomId)
            .single()

        if (roomError || !room) {
            console.error('Error fetching room:', roomError)
            showToast('Oda bulunamadı', 'error')
            return
        }

        const { data: existingDeletion } = await supabase
            .from('room_deletions')
            .select('id')
            .eq('room_id', roomId)
            .eq('user_id', session.user.id)
            .maybeSingle()

        if (!existingDeletion) {
            const { error: deletionError } = await supabase
                .from('room_deletions')
                .insert([{
                    room_id: roomId,
                    user_id: session.user.id
                }])

            if (deletionError) {
                console.error('Error deleting room:', deletionError)
                showToast('Oda silinirken bir hata oluştu: ' + deletionError.message, 'error')
                return
            }
        }

        setRooms((prevRooms: Room[]) => prevRooms.filter(r => r.id !== roomId))
        if (currentRoom?.id === roomId) {
            setCurrentRoom(null)
        }
    }, [session.user.id, currentRoom, setRooms, setCurrentRoom, showToast])

    // Gruptan ayrıl (Leave Group)
    const leaveGroup = useCallback(async (roomId: string) => {
        if (!confirm('Gruptan ayrılmak istediğinize emin misiniz?')) return

        const { error } = await supabase
            .from('room_members')
            .delete()
            .eq('room_id', roomId)
            .eq('user_id', session.user.id)

        if (error) {
            console.error('Error leaving group:', error)
            showToast('Gruptan ayrılırken hata oluştu: ' + error.message, 'error')
            return
        }

        // Local state update
        setRooms((prevRooms: Room[]) => prevRooms.filter(r => r.id !== roomId))
        if (currentRoom?.id === roomId) {
            setCurrentRoom(null)
            setView('sidebar')
        }
        showToast('Gruptan ayrıldınız.', 'success')
    }, [session.user.id, currentRoom, setRooms, setCurrentRoom, setView, showToast])

    // Mesaj sil
    const deleteMessage = useCallback(async (messageId: string) => {
        const { data: message, error: messageError } = await supabase
            .from('messages')
            .select('room_id, user_id, file_url')
            .eq('id', messageId)
            .single()

        if (messageError || !message) {
            console.error('Error fetching message:', messageError)
            showToast('Mesaj bulunamadı', 'error')
            return
        }

        const { data: existingDeletion } = await supabase
            .from('message_deletions')
            .select('id')
            .eq('message_id', messageId)
            .eq('user_id', session.user.id)
            .maybeSingle()

        if (!existingDeletion) {
            const { error: deletionError } = await supabase
                .from('message_deletions')
                .insert([{
                    message_id: messageId,
                    user_id: session.user.id
                }])

            if (deletionError) {
                console.error('Error deleting message:', deletionError)
                showToast('Mesaj silinirken bir hata oluştu: ' + deletionError.message, 'error')
                return
            }
        }

        // Update ref to prevent fetching deleted messages later
        if (deletedMessageIdsRef?.current) {
            deletedMessageIdsRef.current.add(messageId)
        }


        // Check if all members have deleted the message
        try {
            // 1. Get total members count
            const { count: memberCount, error: memberError } = await supabase
                .from('room_members')
                .select('*', { count: 'exact', head: true })
                .eq('room_id', message.room_id)

            if (memberError) throw memberError

            // 2. Get total deletions count
            const { count: deletionCount, error: deletionError } = await supabase
                .from('message_deletions')
                .select('*', { count: 'exact', head: true })
                .eq('message_id', messageId)

            if (deletionError) throw deletionError

            // 3. If everyone deleted it, hard delete message and file
            if (memberCount !== null && deletionCount !== null && deletionCount >= memberCount) {
                console.log('All members deleted message, performing hard delete...')

                // Delete file from storage if exists
                if (message.file_url) {
                    try {
                        // Extract file path from public URL
                        // Example: https://.../storage/v1/object/public/chat-files/folder/filename.ext
                        const fileUrlParts = message.file_url.split('chat-files/')
                        if (fileUrlParts.length > 1) {
                            const filePath = fileUrlParts[1]
                            const { error: storageError } = await supabase.storage
                                .from('chat-files')
                                .remove([filePath])

                            if (storageError) {
                                console.error('Error deleting file from storage:', storageError)
                            } else {
                                console.log('File deleted from storage:', filePath)
                            }
                        }
                    } catch (err) {
                        console.error('Error parsing file URL:', err)
                    }
                }

                // Hard delete message (cascade will handle deletions table)
                const { error: hardDeleteError } = await supabase
                    .from('messages')
                    .delete()
                    .eq('id', messageId)

                if (hardDeleteError) {
                    console.error('Error hard deleting message:', hardDeleteError)
                } else {
                    console.log('Message hard deleted successfully')
                }
            }
        } catch (error) {
            console.error('Error checking for hard delete:', error)
        }

        setMessages((prev: Message[]) => prev.filter((msg: Message) => msg.id !== messageId))
    }, [session.user.id, setMessages, showToast])

    // Davet gönder
    const sendInvitation = useCallback(async (inviteeId: string) => {
        if (!currentRoom) return

        if (currentRoom.created_by !== session.user.id) {
            showToast('Sadece oda sahibi davet gönderebilir!', 'error')
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
            if (error.code === '23505') {
                showToast('Bu kullanıcıya zaten davet gönderilmiş!', 'error')
            } else {
                console.error('Error sending invitation:', error)
                showToast('Davet gönderilirken hata oluştu!', 'error')
            }
        } else {
            showToast('Davet başarıyla gönderildi!', 'success')
            setShowInviteModal(false)
        }
    }, [currentRoom, session.user.id, setShowInviteModal, showToast])

    // Daveti kabul et
    const acceptInvitation = useCallback(async (invitationId: string) => {
        const { error } = await supabase
            .from('room_invitations')
            .update({ status: 'accepted' })
            .eq('id', invitationId)
            .eq('invitee_id', session.user.id)

        if (error) {
            console.error('Error accepting invitation:', error)
            showToast('Davet kabul edilirken hata oluştu!', 'error')
        } else {
            fetchPendingInvitations()
            debouncedFetchRooms()
            setShowInvitationsPanel(false)
            showToast('Davet kabul edildi! Odaya katıldınız.', 'success')
        }
    }, [session.user.id, fetchPendingInvitations, debouncedFetchRooms, setShowInvitationsPanel, showToast])

    // Daveti reddet
    const rejectInvitation = useCallback(async (invitationId: string) => {
        const { error } = await supabase
            .from('room_invitations')
            .update({ status: 'rejected' })
            .eq('id', invitationId)
            .eq('invitee_id', session.user.id)

        if (error) {
            console.error('Error rejecting invitation:', error)
            showToast('Davet reddedilirken hata oluştu!', 'error')
        } else {
            fetchPendingInvitations()
            showToast('Davet reddedildi.', 'info')
        }
    }, [session.user.id, fetchPendingInvitations, showToast])

    // Arkadaş ekle
    const handleAddFriend = useCallback(async (code: string | number) => {
        try {
            const { data, error } = await supabase
                .rpc('send_friend_request_by_code', { target_code: code })

            if (error) {
                return { success: false, error: 'Hata oluştu!' }
            } else if (data?.success) {
                showToast('Arkadaşlık isteği gönderildi!', 'success')
                return { success: true }
            } else {
                const errorMsg = data?.error || 'Hata oluştu!'
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
    }, [showToast])

    // Arkadaşlık isteğini kabul et
    const acceptFriendRequest = useCallback(async (requestId: string) => {
        const { error } = await supabase
            .from('friend_requests')
            .update({ status: 'accepted' })
            .eq('id', requestId)
            .eq('receiver_id', session.user.id)

        if (error) {
            console.error('Error accepting friend request:', error)
            showToast('Hata oluştu!', 'error')
        } else {
            fetchFriendRequests()
            fetchFriends()
            showToast('Arkadaşlık isteği kabul edildi!', 'success')
        }
    }, [session.user.id, fetchFriendRequests, fetchFriends, showToast])

    // Arkadaşlık isteğini reddet
    const rejectFriendRequest = useCallback(async (requestId: string) => {
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
    }, [session.user.id, fetchFriendRequests, showToast])

    // Arkadaşlıktan çıkar
    const removeFriend = useCallback(async (friendId: string) => {
        const { error } = await supabase
            .from('friends')
            .delete()
            .or(`and(user_id.eq.${session.user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${session.user.id})`)

        if (error) {
            console.error('Error removing friend:', error)
            showToast('Arkadaş silinirken hata oluştu!', 'error')
            return false
        } else {
            fetchFriends()
            showToast('Arkadaş silindi.', 'success')
            return true
        }
    }, [session.user.id, fetchFriends, showToast])

    // Çıkış yap
    const handleLogout = useCallback(async () => {
        disconnectSocket()
        await supabase.auth.signOut()
    }, [])

    // Oda adı göster
    const getRoomDisplayName = useCallback((room: Room) => {
        if (room.type === 'dm') {
            if (room.otherUser) {
                return room.otherUser.username || room.otherUser.email?.split('@')[0] || 'Unknown User'
            }
            const name = room.name?.replace(/^DM:\s*/, '')
            return name || 'Unknown User'
        }
        return room.name
    }, [])

    // Arkadaş seçimi toggle
    const toggleFriendSelection = useCallback((friendId: string) => {
        setSelectedFriendsForRoom((prev: string[]) =>
            prev.includes(friendId)
                ? prev.filter(id => id !== friendId)
                : [...prev, friendId]
        )
    }, [setSelectedFriendsForRoom])

    // Modal açma işlemleri
    const openCreateRoomModal = useCallback(() => {
        setNewRoomName('')
        setSelectedFriendsForRoom([])
        setShowCreateRoomModal(true)
    }, [setNewRoomName, setSelectedFriendsForRoom, setShowCreateRoomModal])

    const openInviteModal = useCallback(() => {
        fetchUsers()
        setShowInviteModal(true)
    }, [fetchUsers, setShowInviteModal])

    // Profil bilgilerini güncelle (Reload olmadan)
    const handleProfileUpdate = useCallback((updatedUser: User) => {
        // Current user'ı güncelle
        setCurrentUser(updatedUser)

        // Cache'i güncelle
        userCacheRef.current.set(updatedUser.id, updatedUser)

        // Users listesini güncelle (arkadaş listesinde görünmesi için)
        setUsers((prev: User[]) => prev.map(u => u.id === updatedUser.id ? updatedUser : u))

        // Odalardaki otherUser bilgilerini güncelle
        setRooms((prevRooms: Room[]) => prevRooms.map(room => {
            if (room.type === 'dm' && room.otherUser?.id === updatedUser.id) {
                return { ...room, otherUser: updatedUser }
            }
            return room
        }))

        console.log('✅ UI State updated for user:', updatedUser.id)
    }, [setCurrentUser, userCacheRef, setUsers, setRooms])

    return {
        sendMessage,
        handleSelectRoom,
        startDM,
        handleCreateGroup,
        joinRoom,
        deleteRoom,
        deleteMessage,
        sendInvitation,
        acceptInvitation,
        rejectInvitation,
        handleAddFriend,
        acceptFriendRequest,
        rejectFriendRequest,
        handleLogout,
        getRoomDisplayName,
        toggleFriendSelection,
        openCreateRoomModal,
        openInviteModal,
        leaveGroup,
        handleSendMessage,
        handleProfileUpdate,
        removeFriend
    }
}

export default useChatActions
