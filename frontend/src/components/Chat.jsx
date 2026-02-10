import { useEffect } from 'react'
import { useChatState, useChatData, useChatActions, useSocketAndPresence } from '../hooks'
import Toast from './Toast'
import InviteModal from './InviteModal'
import NotificationsPanel from './NotificationsPanel'
import EmptyState from './EmptyState'
import Sidebar from './Sidebar'
import ChatWindow from './ChatWindow'
import CreateGroupModal from './CreateGroupModal'
import AddFriendModal from './AddFriendModal'
import { getSocket } from '../socket'

// containsXSS ve messageSchema validation testleri için '../hooks' üzerinden import edilebilir

/**
 * Ana Chat container component'i
 * Tüm chat işlevselliğini orchestrate eder
 */
export default function Chat({ session, darkMode, onToggleDarkMode }) {
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
        currentUser, userPresence
    } = state

    // Destructure data functions
    const {
        fetchRooms, fetchCurrentUser, fetchSocialData,
        fetchUsers, loadMoreMessages
    } = dataFunctions

    // Destructure actions
    const {
        handleSelectRoom, handleCreateGroup, handleAddFriend,
        deleteRoom, deleteMessage, sendInvitation,
        acceptInvitation, rejectInvitation,
        acceptFriendRequest, rejectFriendRequest,
        handleLogout, getRoomDisplayName
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
                onClose={() => state.showToast(null)}
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
            <div className={`flex h-screen w-full bg-white dark:bg-slate-900 overflow-hidden relative`}>
                {/* Sidebar */}
                <div className={`${view === 'sidebar' ? 'flex' : 'hidden'} md:flex w-full md:w-[320px] shrink-0 border-r border-gray-100 dark:border-slate-800`}>
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
                                status: msg.status
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
        </>
    )
}
