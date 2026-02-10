import { useCallback } from 'react'
import { z } from 'zod'
import DOMPurify from 'dompurify'
import { supabase } from '../supabaseClient'
import { getSocket, disconnectSocket } from '../socket'

// XSS kontrolü yapan fonksiyon
export const containsXSS = (msg) => {
    const clean = DOMPurify.sanitize(msg)
    return clean.trim() !== msg.trim()
}

export const messageSchema = z.string()
    .min(1, "Mesaj boş olamaz")
    .max(2000, "Mesaj çok uzun")
    .refine(msg => !containsXSS(msg), { message: "Geçersiz içerik (HTML veya Script içeremez)" })

/**
 * Chat action fonksiyonları için custom hook
 * Kullanıcı etkileşimlerini içerir
 */
export function useChatActions(session, state, dataFunctions) {
    const {
        rooms, setRooms,
        currentRoom, setCurrentRoom,
        setMessages,
        newMessage, setNewMessage,
        setShowInviteModal, setShowInvitationsPanel,
        setShowCreateRoomModal,
        setNewRoomName, setSelectedFriendsForRoom,
        setActiveTab, setView,
        showToast
    } = state

    const {
        debouncedFetchRooms,
        fetchFriendRequests, fetchFriends,
        fetchPendingInvitations, fetchUsers
    } = dataFunctions

    // Mesaj gönder
    const sendMessage = useCallback(async (e) => {
        e?.preventDefault?.()

        const trimmedMessage = newMessage.trim()

        try {
            messageSchema.parse(trimmedMessage)
        } catch {
            // Zod hatası değilse atla
            return
        }

        if (!currentRoom) return

        const socket = getSocket()
        socket.emit('sendMessage', {
            roomId: currentRoom.id,
            userId: session.user.id,
            content: newMessage.trim()
        })

        setNewMessage('')
    }, [newMessage, currentRoom, session.user.id, setNewMessage])

    // Oda seç - startDM inline olarak kullanılıyor
    const handleSelectRoom = useCallback(async (room) => {
        if ((room.type === 'dm' || room.type === 'Direkt Mesaj') && room.otherUser) {
            const existingDM = rooms.find(r =>
                r.type === 'dm' &&
                r.otherUser?.id === room.otherUser.id
            )

            if (existingDM) {
                setCurrentRoom(existingDM)
                setView('chat')
                return
            } else {
                // Inline DM creation
                const dmName = `DM: ${room.otherUser.username || room.otherUser.id.slice(0, 8)}`
                const { data: newRoom, error: roomError } = await supabase
                    .from('rooms')
                    .insert([{ name: dmName, type: 'dm', created_by: session.user.id }])
                    .select()
                    .single()

                if (roomError) {
                    console.error('Error creating DM room:', roomError)
                    showToast(`DM oda oluşturulamadı: ${roomError.message}`, 'error')
                    return
                }

                await supabase
                    .from('room_members')
                    .insert([
                        { room_id: newRoom.id, user_id: session.user.id },
                        { room_id: newRoom.id, user_id: room.otherUser.id }
                    ])

                const roomWithOtherUser = { ...newRoom, otherUser: room.otherUser, isMember: true }
                setCurrentRoom(roomWithOtherUser)
                setView('chat')
                return
            }
        }

        const existingRoom = rooms.find(r => r.id === room.id)
        if (existingRoom) {
            setCurrentRoom(existingRoom)
        } else {
            setCurrentRoom(room)
        }
        setView('chat')
    }, [rooms, setCurrentRoom, setView, session.user.id, showToast])

    // DM başlat
    const startDM = useCallback(async (otherUser) => {
        const existingDM = rooms.find(r =>
            r.type === 'dm' &&
            r.otherUser?.id === otherUser.id
        )

        if (existingDM) {
            setCurrentRoom(existingDM)
            setActiveTab('rooms')
            return
        }

        const dmName = `DM: ${otherUser.username || otherUser.id.slice(0, 8)}`

        const { data: newRoom, error: roomError } = await supabase
            .from('rooms')
            .insert([{ name: dmName, type: 'dm', created_by: session.user.id }])
            .select()
            .single()

        if (roomError) {
            console.error('Error creating DM room:', roomError)
            showToast(`DM oda oluşturulamadı: ${roomError.message}`, 'error')
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

        const roomWithOtherUser = { ...newRoom, otherUser, isMember: true }
        setCurrentRoom(roomWithOtherUser)
        setActiveTab('rooms')
    }, [rooms, session.user.id, setCurrentRoom, setActiveTab, showToast])

    // Grup oluştur
    const handleCreateGroup = useCallback(async (groupName, selectedFriendIds) => {
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
            setRooms(prev => [roomWithMembership, ...prev])
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
    const joinRoom = useCallback(async (room) => {
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
        setRooms(prevRooms => prevRooms.map(r => r.id === room.id ? updatedRoom : r))
        setCurrentRoom(updatedRoom)
    }, [session.user.id, setRooms, setCurrentRoom, showToast])

    // Oda sil
    const deleteRoom = useCallback(async (roomId, e) => {
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

        setRooms(prevRooms => prevRooms.filter(r => r.id !== roomId))
        if (currentRoom?.id === roomId) {
            setCurrentRoom(null)
        }
    }, [session.user.id, currentRoom, setRooms, setCurrentRoom, showToast])

    // Mesaj sil
    const deleteMessage = useCallback(async (messageId) => {
        const { data: message, error: messageError } = await supabase
            .from('messages')
            .select('room_id, user_id')
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

        setMessages(prev => prev.filter(msg => msg.id !== messageId))
    }, [session.user.id, setMessages, showToast])

    // Davet gönder
    const sendInvitation = useCallback(async (inviteeId) => {
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
    const acceptInvitation = useCallback(async (invitationId) => {
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
    const rejectInvitation = useCallback(async (invitationId) => {
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
    const handleAddFriend = useCallback(async (code) => {
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
    const acceptFriendRequest = useCallback(async (requestId) => {
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
    const rejectFriendRequest = useCallback(async (requestId) => {
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

    // Çıkış yap
    const handleLogout = useCallback(async () => {
        disconnectSocket()
        await supabase.auth.signOut()
    }, [])

    // Oda adı göster
    const getRoomDisplayName = useCallback((room) => {
        if (room.type === 'dm') {
            if (room.otherUser) {
                return room.otherUser.username || room.otherUser.email?.split('@')[0] || 'Unknown User'
            }
            const name = room.name.replace(/^DM:\s*/, '')
            return name || 'Unknown User'
        }
        return room.name
    }, [])

    // Arkadaş seçimi toggle
    const toggleFriendSelection = useCallback((friendId) => {
        setSelectedFriendsForRoom(prev =>
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
        openInviteModal
    }
}

export default useChatActions
