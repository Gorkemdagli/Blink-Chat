import { ArrowLeft, Search, MoreHorizontal, X } from 'lucide-react'
import { Room, User, Message } from '../types'

interface ChatHeaderProps {
    selectedRoom: Room
    onBack: () => void
    onUserClick: (user: User) => void
    userPresence: Map<string, { online: boolean; lastSeen: string }>
    lastMessages: { [key: string]: Message }
    onInviteClick?: () => void
    showMenu: boolean
    setShowMenu: (show: boolean) => void
    onLeaveGroup?: () => void
    onGroupClick?: () => void
}

export default function ChatHeader({
    selectedRoom,
    onBack,
    onUserClick,
    userPresence,
    lastMessages,
    onInviteClick,
    showMenu,
    setShowMenu,
    onLeaveGroup,
    onGroupClick
}: ChatHeaderProps) {
    // Helpers
    const getRoomDisplayName = (room: Room) => {
        if (room.type === 'dm' && room.otherUser) {
            return room.otherUser.username || room.otherUser.email?.split('@')[0] || 'Bilinmeyen Kullanıcı'
        }
        // DM odalarında "DM:" prefix'ini kaldır
        if (room.type === 'dm') {
            return room.name?.replace(/^DM:\s*/i, '') || 'Sohbet'
        }
        return room.name || 'Grup'
    }

    const getRoomAvatar = (room: Room) => {
        // Eğer grubun kendi fotoğrafı varsa onu yükle (yoksa isimden üretilen default avatar kullan)
        if (room.type === 'private' && room.avatar_url) {
            return room.avatar_url
        }

        if (room.type === 'dm' && room.otherUser) {
            const name = room.otherUser.username || room.otherUser.email || 'Bilinmeyen'
            return room.otherUser.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`
        }
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(room.name || 'Grup')}`
    }

    // Son görülme zamanını formatla
    const formatLastSeen = (lastSeen: string | undefined) => {
        if (!lastSeen) return 'Bilinmiyor'

        const now = new Date()
        const seen = new Date(lastSeen)
        const diffMs = now.getTime() - seen.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        // Son 1 saat içindeyse dakika olarak göster
        if (diffMins < 60) {
            if (diffMins < 1) return 'Şimdi'
            return `${diffMins} dk önce`
        }

        // 1 saatten eskiyse saat formatında göster (örn: 15:55)
        return seen.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', hour12: false })
    }

    return (
        <header className="h-[64px] md:h-[72px] flex items-center justify-between px-4 md:px-6 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                <button
                    onClick={onBack}
                    className="md:hidden p-2 -ml-2 text-gray-400 hover:text-slate-600 active:bg-gray-100 rounded-full transition-all"
                >
                    <ArrowLeft size={20} />
                </button>

                <div
                    className={`relative shrink-0 ${(selectedRoom.type === 'dm' && selectedRoom.otherUser) || (selectedRoom.type === 'private' && onGroupClick) ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                    onClick={() => {
                        if (selectedRoom.type === 'dm' && selectedRoom.otherUser) {
                            onUserClick(selectedRoom.otherUser)
                        } else if (selectedRoom.type === 'private' && onGroupClick) {
                            onGroupClick()
                        }
                    }}
                >
                    <img
                        src={getRoomAvatar(selectedRoom)}
                        className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover"
                        alt={getRoomDisplayName(selectedRoom)}
                    />
                </div>

                <div className="overflow-hidden">
                    <h2
                        className={`font-bold text-slate-900 dark:text-white leading-tight truncate text-sm md:text-base ${(selectedRoom.type === 'dm') || (selectedRoom.type === 'private' && onGroupClick) ? 'cursor-pointer hover:underline' : ''}`}
                        onClick={() => {
                            if (selectedRoom.type === 'dm' && selectedRoom.otherUser) {
                                onUserClick(selectedRoom.otherUser)
                            } else if (selectedRoom.type === 'private' && onGroupClick) {
                                onGroupClick()
                            }
                        }}
                    >
                        {getRoomDisplayName(selectedRoom)}
                    </h2>
                    {/* DM odalarında online/offline durumu */}
                    {selectedRoom.type === 'dm' && selectedRoom.otherUser && (() => {
                        const presence = userPresence.get(selectedRoom.otherUser.id)
                        const isOnline = presence?.online || false
                        // Eğer presence bilgisi yoksa, son mesajın zamanını kullan
                        let lastSeen = presence?.lastSeen
                        if (!lastSeen && lastMessages[selectedRoom.id]) {
                            const lastMsg = lastMessages[selectedRoom.id]
                            if (lastMsg.user_id === selectedRoom.otherUser.id && lastMsg.created_at) {
                                lastSeen = lastMsg.created_at
                            }
                        }

                        return (
                            <p className="text-[10px] md:text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                                {isOnline ? (
                                    <>
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                        <span>Çevrimiçi</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-600"></span>
                                        <span>Son görülme: {formatLastSeen(lastSeen)}</span>
                                    </>
                                )}
                            </p>
                        )
                    })()}
                    {/* Grup odalarında sadece "Grup" yazısı */}
                    {selectedRoom.type === 'private' && (
                        <p className="text-[10px] md:text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                            {selectedRoom.isOwner && <span className="text-emerald-500">Sahip</span>}
                        </p>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4 text-gray-400">
                {selectedRoom.type === 'private' && selectedRoom.isOwner && onInviteClick && (
                    <button
                        onClick={onInviteClick}
                        className="p-2 hover:text-sky-600 transition-colors"
                        title="Üye Davet Et"
                    >
                        <Search size={18} className="md:w-5 md:h-5" />
                    </button>
                )}
                <div className="relative">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-2 hover:text-slate-600 transition-colors"
                    >
                        <MoreHorizontal size={18} className="md:w-5 md:h-5" />
                    </button>

                    {/* Dropdown Menu */}
                    {showMenu && (
                        <>
                            <div
                                className="fixed inset-0 z-10"
                                onClick={() => setShowMenu(false)}
                            />
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-100 dark:border-slate-700 py-1 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                {selectedRoom.type === 'private' && onLeaveGroup && (
                                    <button
                                        onClick={() => {
                                            setShowMenu(false)
                                            onLeaveGroup()
                                        }}
                                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                                    >
                                        <X size={16} />
                                        Gruptan Ayrıl
                                    </button>
                                )}
                                {/* Add more menu items here if needed */}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    )
}
