import { useState } from 'react'
import {
  Bell,
  LogOut,
  Plus,
  Users,
  Lock,
  Copy,
  Check,
  Moon,
  Sun
} from 'lucide-react'

export default function Sidebar({
  rooms = [],
  friends = [],
  selectedRoomId,
  onSelectRoom,
  onCreateGroupClick,
  onAddFriendClick,
  currentUser,
  onLogout,
  unreadCounts = {},
  pendingInvitationsCount = 0,
  friendRequestsCount = 0,
  onNotificationsClick,
  onDeleteRoom,
  lastMessages = {},
  session,
  userPresence = new Map(),
  darkMode,
  onToggleDarkMode
}) {
  const [activeTab, setActiveTab] = useState('Odalar')
  const [copiedCode, setCopiedCode] = useState(false)

  const totalNotifications = pendingInvitationsCount + friendRequestsCount

  // DM odalarında karşı taraftaki kullanıcının adını göster
  const getRoomDisplayName = (room) => {
    if (room.type === 'dm') {
      // DM odaları için karşı taraftaki kullanıcının adını göster
      if (room.otherUser) {
        return room.otherUser.username || room.otherUser.email?.split('@')[0] || 'Bilinmeyen Kullanıcı'
      }
      // Fallback: oda isminden al
      return room.name.replace(/^DM:\s*/i, '')
    }
    return room.name
  }

  // Son görülme zamanını formatla
  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Bilinmiyor'

    const now = new Date()
    const seen = new Date(lastSeen)
    const diffMs = now - seen
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Şimdi'
    if (diffMins < 60) return `${diffMins} dakika önce`
    if (diffHours < 24) return `${diffHours} saat önce`
    if (diffDays === 1) return 'Dün'
    if (diffDays < 7) return `${diffDays} gün önce`

    // Daha uzun süreler için tarih göster
    return seen.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
  }

  // User code'u kopyala
  const copyUserCode = async () => {
    if (currentUser?.user_code) {
      try {
        await navigator.clipboard.writeText(currentUser.user_code.toString())
        setCopiedCode(true)
        setTimeout(() => setCopiedCode(false), 2000)
      } catch (err) {
        console.error('Failed to copy:', err)
      }
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-slate-900 border-r border-gray-100 dark:border-slate-800 transition-colors">
      {/* Header */}
      <div className="h-[64px] md:h-[72px] px-4 md:px-6 flex items-center justify-between shrink-0 border-b border-gray-100 dark:border-slate-800">
        <h1 className="text-xl font-bold tracking-tight dark:text-white transition-colors">Chat App</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleDarkMode}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
            title={darkMode ? "Açık Mod" : "Koyu Mod"}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            onClick={onNotificationsClick || onAddFriendClick}
            className="relative p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
            title="Bildirimler"
          >
            <Bell size={20} />
            {totalNotifications > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 md:px-5 mb-4 shrink-0 pt-4">
        <div className="flex p-1 bg-gray-100 dark:bg-slate-800 rounded-lg transition-colors">
          {['Odalar', 'Arkadaşlar'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === tab
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content Scroll Area */}
      <div className="flex-1 overflow-y-auto px-2 space-y-6">
        {activeTab === 'Odalar' && (
          <section className="animate-in fade-in slide-in-from-left-2 duration-200">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Odalarınız</span>
              <button
                onClick={onCreateGroupClick}
                className="text-sky-500 hover:bg-sky-50 p-1 rounded transition-colors"
                title="Yeni Grup Oluştur"
              >
                <Plus size={18} />
              </button>
            </div>
            <div className="space-y-0.5">
              {rooms.length === 0 ? (
                <div className="px-3 py-4 text-center text-gray-400 dark:text-gray-500 text-sm">
                  Henüz oda yok. Bir tane oluştur!
                </div>
              ) : (
                rooms.map(room => (
                  <button
                    key={room.id}
                    onClick={() => onSelectRoom(room)}
                    className={`w-full text-left px-3 py-3 rounded-lg flex flex-col gap-0.5 transition-all relative ${selectedRoomId === room.id
                      ? 'bg-sky-50 dark:bg-sky-900/20 border-l-4 border-sky-500'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-800/50 border-l-4 border-transparent'
                      }`}
                  >
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-2">
                        {/* DM odalarında online/offline göstergesi */}
                        {room.type === 'dm' && room.otherUser && (() => {
                          const presence = userPresence.get(room.otherUser.id)
                          const isOnline = presence?.online || false
                          return (
                            <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-600'}`}></span>
                          )
                        })()}
                        <span className={`font-semibold text-sm ${selectedRoomId === room.id ? 'text-sky-700 dark:text-sky-400' : 'text-slate-900 dark:text-gray-200'}`}>
                          {getRoomDisplayName(room)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {unreadCounts[room.id] > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full">
                            {unreadCounts[room.id] > 99 ? '99+' : unreadCounts[room.id]}
                          </span>
                        )}
                        {onDeleteRoom && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation()
                              onDeleteRoom(room.id)
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 p-1 cursor-pointer"
                            title="Odayı sil"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                e.stopPropagation()
                                onDeleteRoom(room.id)
                              }
                            }}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                    {lastMessages[room.id] && (
                      <p className={`text-xs truncate ${selectedRoomId === room.id ? 'text-sky-600 dark:text-sky-400/80' : 'text-gray-500 dark:text-gray-400'}`}>
                        {room.type === 'private' && lastMessages[room.id].user_id !== session?.user?.id && lastMessages[room.id].user ? (
                          <span className="font-medium">{lastMessages[room.id].user.username || lastMessages[room.id].user.email?.split('@')[0] || 'Bilinmeyen'}: </span>
                        ) : lastMessages[room.id].user_id === session?.user?.id ? (
                          <span>Sen: </span>
                        ) : null}
                        {lastMessages[room.id].message_type === 'image' ? (
                          <span className="italic inline-flex items-center gap-1">🖼️ Görsel</span>
                        ) : lastMessages[room.id].message_type === 'file' ? (
                          <span className="italic inline-flex items-center gap-1">📁 Dosya</span>
                        ) : (
                          lastMessages[room.id].content || lastMessages[room.id].text || ''
                        )}
                      </p>
                    )}
                  </button>
                ))
              )}
            </div>
          </section>
        )}

        {activeTab === 'Arkadaşlar' && (
          <section className="animate-in fade-in slide-in-from-right-2 duration-200">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Arkadaşlar</span>
              <button
                onClick={onAddFriendClick}
                className="text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 p-1 rounded transition-colors"
                title="Arkadaş Ekle"
              >
                <Plus size={18} />
              </button>
            </div>
            <div className="space-y-1">
              {friends.length === 0 ? (
                <div className="px-3 py-4 text-center text-gray-400 dark:text-gray-500 text-sm">
                  Henüz arkadaş yok. İlk arkadaşını ekle!
                </div>
              ) : (
                friends.map(friend => {
                  const user = {
                    id: friend.friend_id || friend.id,
                    username: friend.friend_username || friend.username,
                    email: friend.friend_email || friend.email,
                    user_code: friend.friend_code || friend.user_code,
                    avatar_url: friend.friend_avatar || friend.avatar
                  }
                  return (
                    <div
                      key={user.id}
                      className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                      onClick={() => onSelectRoom({
                        id: user.id,
                        name: user.username || user.email || 'Kullanıcı',
                        type: 'dm',
                        otherUser: user
                      })}
                    >
                      <div className="relative">
                        <img
                          src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username || user.email}`}
                          className="w-9 h-9 rounded-full bg-gray-200 dark:bg-slate-700"
                          alt={user.username || user.email}
                        />
                        {friend.online && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                        )}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-semibold truncate text-slate-900 dark:text-gray-200">
                          {user.username || user.email || 'Kullanıcı'}
                        </p>
                        {user.user_code && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">#{user.user_code}</p>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="h-[72px] md:h-[80px] px-4 md:px-6 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900/50 transition-colors">
        <div className="flex items-center gap-3">
          <img
            src={currentUser?.avatar_url || `https://ui-avatars.com/api/?name=${currentUser?.username || 'Kullanıcı'}`}
            className="w-10 h-10 rounded-full border border-gray-100 dark:border-slate-700"
            alt="Me"
          />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
              {currentUser?.username || currentUser?.email?.split('@')[0] || 'Kullanıcı'}
            </span>
            {currentUser?.user_code && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">#{currentUser.user_code}</span>
                <button
                  onClick={copyUserCode}
                  className="p-0.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition-colors group"
                  title="Kodu kopyala"
                >
                  {copiedCode ? (
                    <Check size={12} className="text-green-500" />
                  ) : (
                    <Copy size={12} className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onLogout}
          className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-1.5 uppercase tracking-tight"
        >
          <LogOut size={14} />
          Çıkış Yap
        </button>
      </div>
    </div>
  )
}

