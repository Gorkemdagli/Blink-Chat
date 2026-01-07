import { useState } from 'react'
import { 
  Search, 
  MoreHorizontal, 
  Plus, 
  LogOut, 
  Paperclip, 
  Smile, 
  Send, 
  Lock,
  ChevronLeft,
  UserPlus
} from 'lucide-react'

export default function ChatInterfacePreview() {
  const [activeTab, setActiveTab] = useState('rooms')
  const [activeView, setActiveView] = useState('sidebar')
  const [selectedId, setSelectedId] = useState('1')
  
  // Mock Rooms Data
  const rooms = [
    { id: '1', name: 'Proje Ekibi', type: 'group', role: 'Sahip', lastMessage: 'Toplantı notlarını paylaştım, kontrol edebilir misiniz?', time: '14:32' },
    { id: '2', name: 'Yazılım Geliştirme', type: 'group', role: 'Üye', lastMessage: 'Yeni özellik için PR hazırladım', time: '13:15' },
    { id: '3', name: 'Tasarım Grubu', type: 'group', role: 'Üye', lastMessage: 'Mockup\'lar hazır, feedback bekliyorum', time: '12:45' },
    { id: '4', name: 'Ahmet Yılmaz', type: 'direct', role: 'Direkt Mesaj', lastMessage: 'Yarınki toplantıya katılabilecek misin?', time: '11:20' },
    { id: '5', name: 'Zeynep Su', type: 'direct', role: 'Direkt Mesaj', lastMessage: 'Teşekkürler! Çok yardımcı oldun', time: 'Dün' },
    { id: '6', name: 'Canberk Öz', type: 'direct', role: 'Direkt Mesaj', lastMessage: 'Kod review yapabilir misin?', time: 'Dün' },
    { id: '7', name: 'Merve Aydın', type: 'direct', role: 'Direkt Mesaj', lastMessage: 'Harika bir iş çıkardın!', time: '2 gün önce' },
  ]

  // Mock Friends Data
  const friends = [
    { id: 'f1', name: 'Ahmet Yılmaz', status: 'online', avatarColor: 'bg-emerald-100 text-emerald-700' },
    { id: 'f2', name: 'Zeynep Su', status: 'offline', lastSeen: '2 saat önce', avatarColor: 'bg-purple-100 text-purple-700' },
    { id: 'f3', name: 'Canberk Öz', status: 'online', avatarColor: 'bg-orange-100 text-orange-700' },
    { id: 'f4', name: 'Merve Aydın', status: 'offline', lastSeen: 'Dün', avatarColor: 'bg-pink-100 text-pink-700' },
    { id: 'f5', name: 'Emre Demir', status: 'online', avatarColor: 'bg-blue-100 text-blue-700' },
    { id: 'f6', name: 'Ayşe Kaya', status: 'online', avatarColor: 'bg-yellow-100 text-yellow-700' },
    { id: 'f7', name: 'Mehmet Şahin', status: 'offline', lastSeen: '5 dakika önce', avatarColor: 'bg-indigo-100 text-indigo-700' },
  ]

  // Mock Messages Data - Group Chat (Proje Ekibi)
  const groupMessages = [
    { id: 'm1', sender: 'ahmet', senderName: 'Ahmet Yılmaz', text: 'Merhaba herkese! Bugünkü toplantı için hazır mısınız?', timestamp: '09:15', isMe: false },
    { id: 'm2', sender: 'me', senderName: 'Sen', text: 'Evet hazırım, gündem maddelerini paylaşabilir misin?', timestamp: '09:16', isMe: true },
    { id: 'm3', sender: 'zeynep', senderName: 'Zeynep Su', text: 'Ben de hazırım. Toplantı notlarını önceden göndermiştiniz, çok faydalı oldu.', timestamp: '09:17', isMe: false },
    { id: 'm4', sender: 'canberk', senderName: 'Canberk Öz', text: 'Yeni özellik için mockup\'lar hazır. Feedback bekliyorum.', timestamp: '09:20', isMe: false },
    { id: 'm5', sender: 'me', senderName: 'Sen', text: 'Harika görünüyor! Renk paleti çok uyumlu olmuş.', timestamp: '09:22', isMe: true },
    { id: 'm6', sender: 'ahmet', senderName: 'Ahmet Yılmaz', text: 'Evet, tasarım ekibimiz gerçekten iyi iş çıkarmış. Devam edelim mi?', timestamp: '09:25', isMe: false },
    { id: 'm7', sender: 'zeynep', senderName: 'Zeynep Su', text: 'Kesinlikle! Hemen implementasyona başlayabiliriz.', timestamp: '09:26', isMe: false },
    { id: 'm8', sender: 'me', senderName: 'Sen', text: 'Mükemmel! Toplantıda detayları konuşuruz.', timestamp: '09:27', isMe: true },
    { id: 'm9', sender: 'canberk', senderName: 'Canberk Öz', text: 'Toplantı notlarını paylaştım, kontrol edebilir misiniz?', timestamp: '14:32', isMe: false },
  ]

  // Mock Messages Data - Direct Message (Ahmet Yılmaz)
  const directMessages = [
    { id: 'dm1', sender: 'ahmet', senderName: 'Ahmet Yılmaz', text: 'Merhaba! Yarınki toplantıya katılabilecek misin?', timestamp: '10:30', isMe: false },
    { id: 'dm2', sender: 'me', senderName: 'Sen', text: 'Evet, katılacağım. Saat kaçta başlıyor?', timestamp: '10:32', isMe: true },
    { id: 'dm3', sender: 'ahmet', senderName: 'Ahmet Yılmaz', text: 'Saat 14:00\'da başlayacak. Konferans salonunda olacağız.', timestamp: '10:33', isMe: false },
    { id: 'dm4', sender: 'me', senderName: 'Sen', text: 'Tamam, not aldım. Görüşürüz!', timestamp: '10:35', isMe: true },
    { id: 'dm5', sender: 'ahmet', senderName: 'Ahmet Yılmaz', text: 'Harika! Yarın görüşürüz o zaman.', timestamp: '10:36', isMe: false },
  ]


  const activeRoom = rooms.find(r => r.id === selectedId)
  const activeFriend = friends.find(f => f.id === selectedId)
  const isChattingWithFriend = !!activeFriend

  // Select messages based on active room/friend
  const getMessages = () => {
    if (isChattingWithFriend) {
      // Direct message with friend - show direct messages
      return directMessages
    } else if (activeRoom) {
      // Group chat room
      if (activeRoom.id === '1') {
        // Proje Ekibi room - show group messages
        return groupMessages
      } else {
        // Other rooms - return sample messages
        return [
          { id: 'm1', sender: 'user1', senderName: 'Kullanıcı 1', text: 'Merhaba! Nasılsınız?', timestamp: '10:00', isMe: false },
          { id: 'm2', sender: 'me', senderName: 'Sen', text: 'İyiyim teşekkürler, sen nasılsın?', timestamp: '10:01', isMe: true },
          { id: 'm3', sender: 'user2', senderName: 'Kullanıcı 2', text: 'Harika bir gün geçiriyoruz!', timestamp: '10:05', isMe: false },
        ]
      }
    }
    // Default: return group messages
    return groupMessages
  }

  const messages = getMessages()
  
  // Get display name for active entity
  const getDisplayName = () => {
    if (isChattingWithFriend && activeFriend) {
      return activeFriend.name
    } else if (activeRoom) {
      return activeRoom.name
    }
    return 'Chat App'
  }

  const handleEntityClick = (id) => {
    setSelectedId(id)
    setActiveView('chat')
  }

  return (
    <div className="flex h-[600px] md:h-[800px] w-full max-w-7xl mx-auto bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden mt-6 md:mt-12 mb-10 md:mb-20 transition-all duration-300">
      
      {/* Sidebar - Hidden on mobile when chat is active */}
      <div className={`w-full md:w-80 flex flex-col border-r border-slate-100 bg-slate-50/50 ${activeView === 'chat' ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Chat App</h2>
          <div className="flex gap-2">
            <button className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors relative">
              <div className="w-2 h-2 bg-red-500 rounded-full absolute top-1 right-1 border border-white"></div>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v1m6 0H9"></path></svg>
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="px-4 mb-4">
          <div className="flex bg-slate-200/50 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('rooms')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${activeTab === 'rooms' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Rooms
            </button>
            <button 
              onClick={() => setActiveTab('friends')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${activeTab === 'friends' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Friends
            </button>
          </div>
        </div>

        {/* List Header */}
        <div className="px-4 py-2 flex justify-between items-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          <span>{activeTab === 'rooms' ? 'Your Rooms' : 'Your Friends'}</span>
          {activeTab === 'rooms' ? (
            <Plus className="w-3.5 h-3.5 cursor-pointer hover:text-blue-600 transition-colors" />
          ) : (
            <UserPlus className="w-3.5 h-3.5 cursor-pointer hover:text-blue-600 transition-colors" />
          )}
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {activeTab === 'rooms' ? (
            rooms.map((room) => (
              <div 
                key={room.id}
                onClick={() => handleEntityClick(room.id)}
                className={`group flex items-center p-3 mb-1 rounded-xl cursor-pointer transition-all ${selectedId === room.id ? 'bg-blue-50/80 border-l-2 border-blue-500' : 'hover:bg-slate-100'}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${selectedId === room.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-600'}`}>
                  {room.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="ml-3 flex-1 overflow-hidden">
                  <div className="flex justify-between items-center">
                    <span className={`text-sm font-semibold truncate ${selectedId === room.id ? 'text-blue-700' : 'text-slate-700'}`}>{room.name}</span>
                    <span className="text-[10px] text-slate-400">{room.time}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium truncate">
                    {room.type === 'direct' ? <Lock className="w-2.5 h-2.5 shrink-0" /> : <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"></div>}
                    <span className="truncate">{room.lastMessage}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            friends.map((friend) => (
              <div 
                key={friend.id}
                onClick={() => handleEntityClick(friend.id)}
                className={`group flex items-center p-3 mb-1 rounded-xl cursor-pointer transition-all ${selectedId === friend.id ? 'bg-blue-50/80 border-l-2 border-blue-500' : 'hover:bg-slate-100'}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 relative ${friend.avatarColor}`}>
                  {friend.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  {friend.status === 'online' && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                  )}
                </div>
                <div className="ml-3 flex-1 overflow-hidden">
                  <div className="flex justify-between items-center">
                    <span className={`text-sm font-semibold truncate ${selectedId === friend.id ? 'text-blue-700' : 'text-slate-700'}`}>{friend.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium truncate">
                    {friend.status === 'online' ? (
                      <span className="text-green-600 font-bold">Online</span>
                    ) : (
                      <span>{friend.lastSeen || 'Offline'}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* User Info Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 shrink-0 text-xs">
              GO
            </div>
            <div className="ml-3">
            <p className="text-sm font-bold text-slate-800 leading-tight">Görkem Dağlı</p>
              <p className="text-[10px] text-slate-400">#0000000</p>
            </div>
          </div>
          <button className="flex items-center text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors uppercase tracking-widest gap-1">
            <LogOut className="w-3 h-3" /> Logout
          </button>
        </div>
      </div>

      {/* Main Chat Area - Hidden on mobile when sidebar is active */}
      <div className={`flex-1 flex flex-col bg-white ${activeView === 'sidebar' ? 'hidden md:flex' : 'flex'}`}>
        {/* Chat Header */}
        <div className="h-16 px-4 md:px-6 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center overflow-hidden">
            {/* Mobile Back Button */}
            <button 
              onClick={() => setActiveView('sidebar')}
              className="md:hidden mr-2 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            
            <div className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-sm mr-3 shrink-0 ${isChattingWithFriend && activeFriend ? activeFriend.avatarColor : 'bg-slate-100 text-slate-600'}`}>
              {isChattingWithFriend && activeFriend 
                ? activeFriend.name.split(' ').map(n => n[0]).join('').toUpperCase() 
                : (activeRoom ? activeRoom.name.substring(0, 2).toUpperCase() : 'CA')}
            </div>
            <div className="truncate">
              <h3 className="text-sm font-bold text-slate-800 leading-tight truncate">
                {getDisplayName()}
              </h3>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                {isChattingWithFriend ? (
                  <>
                    <div className={`w-1.5 h-1.5 rounded-full ${activeFriend?.status === 'online' ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                    <span>{activeFriend?.status === 'online' ? 'Çevrimiçi' : `Son görülme: ${activeFriend?.lastSeen || 'bilinmiyor'}`}</span>
                  </>
                ) : (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                    <span>Grup</span>
                    <span>•</span>
                    <span>{activeRoom.role}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4 text-slate-400 shrink-0">
            <button className="p-2 hover:bg-slate-50 rounded-lg transition-colors"><Search className="w-5 h-5" /></button>
            <button className="p-2 hover:bg-slate-50 rounded-lg transition-colors"><MoreHorizontal className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-4 bg-white">
          {isChattingWithFriend ? (
             <div className="flex-1 flex flex-col items-center justify-center text-center p-10 opacity-60">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center font-bold text-2xl mb-4 ${activeFriend?.avatarColor}`}>
                  {activeFriend?.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </div>
                <h4 className="text-xl font-bold text-slate-800 mb-2">{activeFriend?.name}</h4>
                <p className="text-sm text-slate-500 max-w-xs">Bu kişiyle olan sohbetinizin başlangıcı. Mesajlarınız uçtan uca şifrelenir.</p>
                <div className="mt-8 px-4 py-2 bg-slate-100 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bugün</div>
             </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-start gap-2 max-w-[85%] md:max-w-[70%] ${msg.isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!msg.isMe && (
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 mt-1">
                      {msg.senderName.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col">
                    {!msg.isMe && <span className="text-[11px] font-bold text-slate-400 mb-1 ml-1">{msg.senderName}</span>}
                    <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                      msg.isMe 
                      ? 'bg-blue-500 text-white rounded-tr-none' 
                      : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/50'
                    }`}>
                      {msg.text}
                    </div>
                    <div className={`flex items-center gap-1 mt-1 text-[10px] text-slate-400 ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                      <span>{msg.timestamp}</span>
                      {msg.isMe && <svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 border-t border-slate-100 bg-white">
          <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-3 md:px-4 py-2 group focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <input 
              type="text" 
              placeholder={isChattingWithFriend ? `${activeFriend?.name} kullanıcısına mesaj gönder...` : "Write a message..."}
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-800 h-10 outline-none"
            />
            <div className="flex items-center gap-1 md:gap-2 shrink-0">
              <button className="p-2 text-slate-400 hover:text-blue-500 transition-colors hidden sm:block"><Paperclip className="w-5 h-5" /></button>
              <button className="p-2 text-slate-400 hover:text-blue-500 transition-colors"><Smile className="w-5 h-5" /></button>
              <button className="bg-blue-500 p-2.5 rounded-xl text-white hover:bg-blue-600 shadow-md transition-all active:scale-95 flex items-center justify-center">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

