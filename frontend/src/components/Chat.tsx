import { useEffect, useState } from 'react'

import { Session } from '@supabase/supabase-js'
import { useChatState, useChatData, useChatActions, useSocketAndPresence } from '../hooks'
import Toast from './Toast'
import ConfirmModal from './ConfirmModal'

import InviteModal from './InviteModal'
import NotificationsPanel from './NotificationsPanel'
import EmptyState from './EmptyState'
import Sidebar from './Sidebar'
import ChatWindow from './ChatWindow'
import CreateGroupModal from './CreateGroupModal'
import AddFriendModal from './AddFriendModal'
import { Message } from '../types'

interface ChatProps {
    session: Session
    darkMode: boolean
    onToggleDarkMode: () => void
}

/**
 * Ana Chat container component'i
 * Tüm chat işlevselliğini orchestrate eder
 */
export default function Chat({ session, darkMode, onToggleDarkMode }: ChatProps) {
    // State Hook
    const state = useChatState()

    // Data Hook
    const dataFunctions = useChatData(session, state)

    // Actions Hook
    const actions = useChatActions(session, state, dataFunctions)

    // Socket & Presence Hook
    useSocketAndPresence(session, state, dataFunctions)

    // Destructure state for ease of use
    const {
        rooms, currentRoom, messages, users,
        friends, friendRequests,
        unreadCounts, lastMessages,
        isLoadingMessages, isLoadingMoreMessages, hasMoreMessages,
        showInviteModal, setShowInviteModal,
        showInvitationsPanel, setShowInvitationsPanel,
        showAddFriendModal, setShowAddFriendModal,
        showCreateRoomModal, setShowCreateRoomModal,
        pendingInvitations,
        toast, view, setView,
        currentUser, userPresence,
        hideToast, showToast
    } = state

    const [roomToDelete, setRoomToDelete] = useState<string | null>(null)

    // Destructure data functions
    const {
        fetchRooms,
        debouncedFetchRooms,
        fetchUsers, loadMoreMessages
    } = dataFunctions

    // Destructure actions
    const {
        handleSelectRoom, handleCreateGroup, handleAddFriend,
        deleteRoom, deleteMessage, sendInvitation,
        acceptInvitation, rejectInvitation,
        acceptFriendRequest, rejectFriendRequest,
        handleLogout, getRoomDisplayName, leaveGroup, handleSendMessage,
        handleProfileUpdate, removeFriend
    } = actions

    // İlk yükleme - TEK RPC çağrısı ile tüm verileri getir (Maksimum Performans)
    useEffect(() => {
        fetchRooms()
    }, [fetchRooms])

    return (
        <>
            {/* Toast Bildirimi */}
            <Toast
                toast={toast}
                onClose={hideToast}
            />

            {/* Davet Modalı */}
            {showInviteModal && currentRoom && (
                <InviteModal
                    currentRoom={currentRoom}
                    users={users}
                    onSendInvitation={sendInvitation}
                    onClose={() => setShowInviteModal(false)}
                />
            )}

            {/* Bildirimler Paneli */}
            {showInvitationsPanel && (
                <NotificationsPanel
                    pendingInvitations={pendingInvitations}
                    friendRequests={friendRequests}
                    onAcceptInvitation={acceptInvitation}
                    onRejectInvitation={rejectInvitation}
                    onAcceptFriendRequest={acceptFriendRequest}
                    onRejectFriendRequest={rejectFriendRequest}
                    onClose={() => setShowInvitationsPanel(false)}
                />
            )}

            {/* Ana Layout */}
            <div className={`flex h-[100dvh] w-full bg-white dark:bg-slate-900 overflow-hidden relative`}>
                {/* Sidebar */}
                <div className={`${view === 'sidebar' ? 'flex' : 'hidden'} md:flex w-full md:w-[320px] shrink-0 border-r border-gray-100 dark:border-slate-800`}>
                    <Sidebar
                        rooms={rooms.map((room: any) => ({
                            id: room.id,
                            name: getRoomDisplayName(room),
                            type: room.type === 'private' ? 'Grup' : 'Direkt Mesaj',
                            status: room.type === 'dm' && room.otherUser?.online ? 'Online' : undefined,
                            role: room.isOwner ? 'Sahip' : undefined,
                            ...room
                        }))}
                        friends={friends}
                        selectedRoomId={currentRoom?.id || null}
                        onSelectRoom={handleSelectRoom}
                        onCreateGroupClick={() => setShowCreateRoomModal(true)}
                        onAddFriendClick={() => {
                            setShowAddFriendModal(true)
                            setShowInvitationsPanel(false)
                        }}
                        onNotificationsClick={() => {
                            setShowInvitationsPanel(!showInvitationsPanel)
                        }}
                        onDeleteRoom={(roomId: string) => {
                            setRoomToDelete(roomId)
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
                        onProfileUpdate={handleProfileUpdate}
                        onRemoveFriend={async (userId) => {
                            const success = await actions.removeFriend(userId)
                            if (success) {
                                // if removing successful, we can navigate away from chat optionally
                                setView('sidebar')
                                debouncedFetchRooms()
                            }
                        }}
                    />
                </div>

                {/* ChatWindow */}
                <div className={`${view === 'chat' ? 'flex' : 'hidden'} md:flex flex-1 h-full`}>
                    {currentRoom ? (
                        <ChatWindow
                            selectedRoom={currentRoom}
                            messages={messages.map((msg: any): Message => ({
                                id: msg.id,
                                content: msg.content,
                                user_id: msg.user_id,
                                room_id: currentRoom.id,
                                created_at: msg.created_at,
                                user: msg.user,
                                file_url: msg.file_url,
                                message_type: msg.message_type,
                                file_name: msg.file_name,
                                file_size: msg.file_size,
                                status: msg.status
                            }))}
                            onSendMessage={handleSendMessage}
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
                            onLeaveGroup={() => leaveGroup(currentRoom.id)}
                            onDeleteRoom={deleteRoom}
                            onRemoveFriend={async (userId) => {
                                const success = await removeFriend(userId)
                                if (success) {
                                    // if removing successful, we can navigate away from chat optionally
                                    setView('sidebar')
                                    debouncedFetchRooms()
                                }
                            }}
                            onAddFriend={handleAddFriend}
                            friends={friends}
                            onProfileUpdate={handleProfileUpdate}
                            onRoomUpdate={debouncedFetchRooms}
                            showToast={showToast}
                        />
                    ) : (
                        <EmptyState />
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

            {/* Room Deletion Confirmation */}
            <ConfirmModal
                isOpen={!!roomToDelete}
                onClose={() => setRoomToDelete(null)}
                onConfirm={() => {
                    if (roomToDelete) {
                        deleteRoom(roomToDelete, { stopPropagation: () => { } } as unknown as React.MouseEvent)
                    }
                }}
                title="Sohbeti Sil"
                description="Bu sohbeti listenizden kaldırmak istediğinize emin misiniz? (Mesajlar diğer katılımcılarda kalmaya devam eder)"
                confirmText="Sohbeti Sil"
                variant="danger"
            />
        </>
    )
}
