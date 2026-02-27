import { useState } from 'react'
import {
  Bell,
  LogOut,
  Plus,
  Moon,
  Sun,
  UserMinus
} from 'lucide-react'
import { Room, User, UnreadCounts, Message } from '../types'
import { Session } from '@supabase/supabase-js'
import ProfileModal from './ProfileModal'

interface SidebarProps {
  rooms: Room[]
  friends: User[]
  selectedRoomId: string | null
  onSelectRoom: (room: Room) => void
  onCreateGroupClick: () => void
  onAddFriendClick: () => void
  currentUser: User | null
  onLogout: () => void
  unreadCounts: UnreadCounts
  pendingInvitationsCount: number
  friendRequestsCount: number
  onNotificationsClick: () => void
  onDeleteRoom: (roomId: string) => void
  lastMessages: { [key: string]: Message }
  session: Session
  userPresence: Map<string, { online: boolean; last_seen?: string }>
  darkMode: boolean
  onToggleDarkMode: () => void
  onProfileUpdate?: (user: User) => void
  onRemoveFriend?: (userId: string) => void
}

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
  onToggleDarkMode,
  onProfileUpdate,
  onRemoveFriend
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState('Odalar')
  const [showProfileModal, setShowProfileModal] = useState(false)

  const totalNotifications = pendingInvitationsCount + friendRequestsCount

  // DM odalarında karşı taraftaki kullanıcının adını göster
  const getRoomDisplayName = (room: Room) => {
    if (room.type === 'dm') {
      // DM odaları için karşı taraftaki kullanıcının adını göster
      if (room.otherUser) {
        return room.otherUser.username || room.otherUser.email?.split('@')[0] || 'Bilinmeyen Kullanıcı'
      }
      // Fallback: oda isminden al
      return room.name?.replace(/^DM:\s*/i, '') || 'Sohbet'
    }
    return room.name || 'Grup'
  }


  const handleProfileUpdate = (updatedUser: User) => {
    setShowProfileModal(false)
    if (onProfileUpdate) {
      onProfileUpdate(updatedUser)
    }
  }

  return (
    <aside aria-label="Ana Kenar Çubuğu" className="w-full h-full flex flex-col bg-white dark:bg-slate-900 border-r border-gray-100 dark:border-slate-800">
      {/* Header */}
      <div className="h-[64px] md:h-[72px] px-4 md:px-6 flex items-center justify-between shrink-0 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <img src="/favicon-active.svg" alt="Blink Logo" className="w-6 h-6 md:w-8 md:h-8" />
          <h1 className="text-xl font-bold tracking-tight dark:text-white">Blink</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleDarkMode}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
            title={darkMode ? "Açık Mod" : "Koyu Mod"}
            aria-label={darkMode ? "Açık Moda Geç" : "Koyu Moda Geç"}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            onClick={onNotificationsClick || onAddFriendClick}
            className="relative p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
            title="Bildirimler"
            aria-label={`Bildirimler, ${totalNotifications} okunmamış bildirim`}
          >
            <Bell size={20} />
            {totalNotifications > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <nav className="px-4 md:px-5 mb-4 shrink-0 pt-4" aria-label="Kenar Çubuğu Sekmeleri">
        <div className="flex p-1 bg-gray-100 dark:bg-slate-800 rounded-lg" role="tablist">
          {['Odalar', 'Arkadaşlar'].map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`${tab.toLowerCase()}-panel`}
              id={`${tab.toLowerCase()}-tab`}
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
      </nav>

      {/* Content Scroll Area */}
      <div className="flex-1 overflow-y-auto px-2 space-y-6">
        {activeTab === 'Odalar' && (
          <section id="odalar-panel" role="tabpanel" aria-labelledby="odalar-tab" className="animate-in fade-in slide-in-from-left-2 duration-200">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Odalarınız</span>
              <button
                onClick={onCreateGroupClick}
                className="text-sky-500 hover:bg-sky-50 p-1 rounded transition-colors"
                title="Yeni Grup Oluştur"
                aria-label="Yeni Grup Oluştur"
              >
                <Plus size={18} aria-hidden="true" />
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
                    aria-label={`${getRoomDisplayName(room)} odasını aç. ${unreadCounts[room.id] > 0 ? `${unreadCounts[room.id]} okunmamış mesaj var` : 'Okunmamış mesaj yok'}`}
                    aria-current={selectedRoomId === room.id ? "page" : undefined}
                    className={`w-full text-left px-3 py-3 rounded-lg flex flex-col gap-0.5 transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${selectedRoomId === room.id
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
                            className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity text-red-500 hover:text-red-700 p-1 cursor-pointer rounded"
                            title="Odayı sil"
                            aria-label={`${getRoomDisplayName(room)} odasını sil`}
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
                          <span className="font-medium">{lastMessages[room.id].user?.username || lastMessages[room.id].user?.email?.split('@')[0] || 'Bilinmeyen'}: </span>
                        ) : lastMessages[room.id].user_id === session?.user?.id ? (
                          <span>Sen: </span>
                        ) : null}
                        {lastMessages[room.id].message_type === 'image' ? (
                          <span className="italic inline-flex items-center gap-1">🖼️ Görsel</span>
                        ) : lastMessages[room.id].message_type === 'file' ? (
                          <span className="italic inline-flex items-center gap-1">📁 Dosya</span>
                        ) : (
                          lastMessages[room.id].content || (lastMessages[room.id] as any).text || ''
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
          <section id="arkadaşlar-panel" role="tabpanel" aria-labelledby="arkadaşlar-tab" className="animate-in fade-in slide-in-from-right-2 duration-200">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Arkadaşlar</span>
              <button
                onClick={onAddFriendClick}
                className="text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 p-1 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                title="Arkadaş Ekle"
                aria-label="Arkadaş Ekle"
              >
                <Plus size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-1">
              {friends.length === 0 ? (
                <div className="px-3 py-4 text-center text-gray-400 dark:text-gray-500 text-sm">
                  Henüz arkadaş yok. İlk arkadaşını ekle!
                </div>
              ) : (
                friends.map((friend: any) => {
                  const user = {
                    id: friend.friend_id || friend.id,
                    username: friend.friend_username || friend.username,
                    email: friend.friend_email || friend.email,
                    user_code: friend.friend_code || friend.user_code,
                    avatar_url: friend.friend_avatar || friend.avatar
                  } as User
                  return (
                    <button
                      key={user.id}
                      className="w-full text-left group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      aria-label={`${user.username || user.email || 'Bilinmeyen Kullanıcı'} ile direkt mesaj başlat`}
                      onClick={() => onSelectRoom({
                        id: user.id,
                        name: user.username || user.email || 'Kullanıcı',
                        type: 'dm',
                        otherUser: user,
                        created_at: '',
                        created_by: ''
                      })}
                    >
                      <div className="relative">
                        <img
                          src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || user.email || 'U')}`}
                          className="w-9 h-9 rounded-full bg-gray-200 dark:bg-slate-700 object-cover"
                          alt={user.username || user.email || ''}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.onerror = null;
                            target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || user.email || 'U')}`;
                          }}
                        />
                        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${userPresence.get(user.id)?.online ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-600'}`}></span>
                      </div>
                      <div className="flex-1 overflow-hidden pointer-events-none">
                        <p className="text-sm font-semibold truncate text-slate-900 dark:text-gray-200">
                          {user.username || user.email || 'Bilinmeyen Kullanıcı'}
                        </p>
                        {user.user_code && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">#{user.user_code}</p>
                        )}
                      </div>

                      {onRemoveFriend && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm('Arkadaşlıktan çıkarmak istediğinize emin misiniz?')) {
                              onRemoveFriend(user.id)
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity text-red-500 hover:text-red-700 p-1.5 cursor-pointer rounded z-10"
                          title="Arkadaşlıktan çıkar"
                          aria-label={`${user.username || user.email || 'Kullanıcı'} arkadaşını çıkar`}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              e.stopPropagation()
                              if (confirm('Arkadaşlıktan çıkarmak istediğinize emin misiniz?')) {
                                onRemoveFriend(user.id)
                              }
                            }
                          }}
                        >
                          <UserMinus size={18} />
                        </div>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="h-[72px] md:h-[80px] px-4 md:px-6 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900/50">
        <button
          className="flex items-center gap-3 w-full text-left -ml-2 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          onClick={() => setShowProfileModal(true)}
          aria-label="Profil görünümünü aç"
        >
          <div className="relative">
            <img
              src={currentUser?.avatar_url || `https://ui-avatars.com/api/?name=${currentUser?.username || 'Kullanıcı'}`}
              className="w-10 h-10 rounded-full border border-gray-100 dark:border-slate-700 group-hover:scale-105 transition-transform object-cover"
              alt="Me"
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-slate-800 rounded-full"></div>
          </div>
          <div className="flex flex-col gap-0.5 overflow-hidden">
            <span className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate">
              {currentUser?.username || currentUser?.email?.split('@')[0] || (currentUser ? 'İsimsiz Kullanıcı' : 'Yükleniyor...')}
            </span>
            {currentUser?.user_code && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">#{currentUser.user_code}</span>
              </div>
            )}
          </div>
        </button>
        <button
          onClick={onLogout}
          className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors ml-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          title="Çıkış Yap"
          aria-label="Hesaptan çıkış yap"
        >
          <LogOut size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Profile Modal */}
      {currentUser && (
        <ProfileModal
          user={currentUser}
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          onUpdate={handleProfileUpdate}
          isOwnProfile={true}
        />
      )}
    </aside>
  )
}
