import { useState, useRef, useEffect } from 'react'
import {
  Search,
  MoreHorizontal,
  Paperclip,
  Smile,
  Send,
  ArrowLeft,
  Image as ImageIcon,
  File as FileIcon,
  X,
  Download,
  FileText
} from 'lucide-react'
import { supabase } from '../supabaseClient'
import { getSocket } from '../socket'
import Picker from '@emoji-mart/react'
import data from '@emoji-mart/data'

export default function ChatWindow({
  selectedRoom,
  messages = [],
  onSendMessage,
  onBack,
  isLoadingMessages = false,
  isLoadingMoreMessages = false,
  hasMoreMessages = false,
  onInviteClick,
  onDeleteMessage,
  onLoadMoreMessages,
  session,
  userPresence = new Map(),
  lastMessages = {},
  currentUser
}) {
  const [inputValue, setInputValue] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [longPressMessageId, setLongPressMessageId] = useState(null)
  const [deleteConfirmMessageId, setDeleteConfirmMessageId] = useState(null)
  const scrollRef = useRef(null)
  const messagesEndRef = useRef(null)
  const isInitialLoadRef = useRef(true)
  const previousRoomIdRef = useRef(null)
  const emojiPickerRef = useRef(null)
  const longPressTimerRef = useRef(null)
  const fileInputRef = useRef(null)
  const [isUploading, setIsUploading] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewImage, setPreviewImage] = useState(null) // State for lightbox
  const [isDragging, setIsDragging] = useState(false) // State for drag and drop
  const [typingUsers, setTypingUsers] = useState(new Map()) // userId -> username
  const typingTimeoutRef = useRef(null)

  // Socket Listener for Typing & Read Receipts
  useEffect(() => {
    if (!selectedRoom) return

    const socket = getSocket()
    if (!socket) return

    const handleTyping = ({ userId, username, isTyping }) => {
      console.log('✍️ Typing event:', { userId, username, isTyping })
      setTypingUsers(prev => {
        const newMap = new Map(prev)
        if (isTyping) {
          newMap.set(userId, username || 'Someone')
        } else {
          newMap.delete(userId)
        }
        console.log('  Updated typing map:', Array.from(newMap.entries()))
        return newMap
      })
    }

    // Typing listeners
    socket.on('typing', ({ userId, username, isTyping }) => handleTyping({ userId, username, isTyping: isTyping }))
    socket.on('stop_typing', ({ userId }) => handleTyping({ userId, isTyping: false }))

    // Mark Read on mount or active
    const markRead = () => {
      if (messages.length > 0 && document.visibilityState === 'visible') {
        const hasUnread = messages.some(m => m.user_id !== session.user.id && m.status !== 'read')
        if (hasUnread) {
          socket.emit('mark_read', { roomId: selectedRoom.id, userId: session.user.id })
        }
      }
    }

    markRead()
    // Listen for visibility change to mark read when user comes back
    document.addEventListener('visibilitychange', markRead)

    return () => {
      socket.off('typing')
      socket.off('stop_typing')
      document.removeEventListener('visibilitychange', markRead)
    }
  }, [selectedRoom, session.user.id])

  // Track last mark_read emission to prevent spam
  const lastMarkReadRef = useRef(0)

  // Mark read when new messages arrive (debounced)
  useEffect(() => {
    if (!selectedRoom || messages.length === 0) return

    // Debounce: Only emit once every 2 seconds max
    const now = Date.now()
    if (now - lastMarkReadRef.current < 2000) return

    const socket = getSocket()
    if (document.visibilityState === 'visible') {
      const hasUnread = messages.some(m => m.user_id !== session.user.id && m.status !== 'read')
      if (hasUnread) {
        lastMarkReadRef.current = now
        socket.emit('mark_read', { roomId: selectedRoom.id, userId: session.user.id })
      }
    }
  }, [messages, selectedRoom, session.user.id])

  const handleInputChange = (e) => {
    setInputValue(e.target.value)

    // Emit typing event
    const socket = getSocket()
    if (socket && selectedRoom) {
      const username = currentUser?.username || session.user.email?.split('@')[0] || 'Unknown';
      socket.emit('typing', { roomId: selectedRoom.id, userId: session.user.id, username })

      // Clear existing timeout
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)

      // Set new timeout to stop typing
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stop_typing', { roomId: selectedRoom.id, userId: session.user.id })
      }, 2000)
    }
  }

  // Mobil kontrolü
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Long press timer cleanup
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
      }
    }
  }, [])

  // Long press menüsünü dışarı tıklandığında kapat
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (longPressMessageId && !event.target.closest('.message-bubble')) {
        setLongPressMessageId(null)
      }
    }

    if (longPressMessageId) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [longPressMessageId])

  // Emoji picker dışına tıklandığında kapat
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        // Smile butonuna tıklanmadıysa kapat
        if (!event.target.closest('button[data-emoji-button]')) {
          setShowEmojiPicker(false)
        }
      }
    }

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showEmojiPicker])

  // Oda değiştiğinde scroll'u sıfırla ve en alta git
  useEffect(() => {
    if (selectedRoom?.id !== previousRoomIdRef.current) {
      isInitialLoadRef.current = true
      previousRoomIdRef.current = selectedRoom?.id
      setShowEmojiPicker(false) // Oda değiştiğinde emoji picker'ı kapat

      // Oda değiştiğinde scroll'u en alta al
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'auto' })
        }
      }, 100)
    }
  }, [selectedRoom?.id])

  // Scroll to bottom: İlk yüklemede ve yeni mesajlarda
  useEffect(() => {
    if (!scrollRef.current) return

    const container = scrollRef.current

    // Loading bittiğinde ve mesajlar varsa en alta git
    if (isInitialLoadRef.current && !isLoadingMessages) {
      if (messages.length > 0) {
        isInitialLoadRef.current = false
        // Mesajlar yüklendikten sonra biraz bekle (DOM güncellensin)
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'auto' })
          }
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
          }
        }, 150)
      }
      return
    }

    // Yeni mesajlar geldiğinde: Sadece kullanıcı alttaysa scroll yap
    if (messages.length > 0 && !isLoadingMessages && !isInitialLoadRef.current) {
      const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100

      if (isAtBottom) {
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
          }
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
          }
        }, 50)
      }
    }
  }, [messages, isLoadingMessages])

  // Pagination: Load more messages when scrolling to top
  useEffect(() => {
    const container = scrollRef.current
    if (!container || !hasMoreMessages || isLoadingMoreMessages || !onLoadMoreMessages) return

    const handleScroll = () => {
      if (container.scrollTop < 100 && hasMoreMessages && !isLoadingMoreMessages) {
        const previousScrollHeight = container.scrollHeight
        const previousScrollTop = container.scrollTop

        onLoadMoreMessages().then(() => {
          requestAnimationFrame(() => {
            if (container) {
              const newScrollHeight = container.scrollHeight
              container.scrollTop = previousScrollTop + (newScrollHeight - previousScrollHeight)
            }
          })
        }).catch(err => {
          console.error('Error loading more messages:', err)
        })
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [hasMoreMessages, isLoadingMoreMessages, onLoadMoreMessages])

  const formatBytes = (bytes, decimals = 1) => {
    if (!bytes) return '0 Bytes'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bayt', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      alert('Dosya boyutu 50MB\'dan büyük olamaz!')
      return
    }

    setSelectedFile(file)
    setShowAttachMenu(false)
    // Focus back to input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]

      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        alert('Dosya boyutu 50MB\'dan büyük olamaz!')
        return
      }

      setSelectedFile(file)
    }
  }

  const uploadFile = async (file) => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { data, error } = await supabase.storage
        .from('chat-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type // Explicitly set content type to ensure correct handling
        })

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from('chat-files')
        .getPublicUrl(filePath)

      console.log('File uploaded:', publicUrl, 'Type:', file.type) // Debug log
      return publicUrl
    } catch (error) {
      console.error('Error uploading file:', error)
      alert('Dosya yüklenirken hata oluştu!')
      return null
    }
  }

  const handleSend = async () => {
    if ((!inputValue.trim() && !selectedFile) || isUploading) return

    let fileUrl = null
    let messageType = 'text'

    if (selectedFile) {
      setIsUploading(true)
      try {
        fileUrl = await uploadFile(selectedFile)
        if (!fileUrl) {
          setIsUploading(false)
          return
        }

        // Determine message type
        const fileExt = (selectedFile.name || '').split('.').pop()?.toLowerCase() || ''
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico']
        const isImage = selectedFile.type?.startsWith('image/') || imageExtensions.includes(fileExt)
        messageType = isImage ? 'image' : 'file'
      } catch (error) {
        console.error('Upload failed:', error)
        setIsUploading(false)
        return
      }
    }

    onSendMessage(inputValue.trim(), fileUrl, messageType, selectedFile ? selectedFile.name : null, selectedFile ? selectedFile.size : null)

    setInputValue('')
    setSelectedFile(null)
    setIsUploading(false)

    // Mesaj gönderildikten sonra scroll'u en alta al
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
      }
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    }, 100)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleEmojiSelect = (emoji) => {
    setInputValue(prev => prev + emoji.native)
    setShowEmojiPicker(false)
  }

  const toggleEmojiPicker = () => {
    setShowEmojiPicker(prev => !prev)
  }

  // Mobil için long press (basılı tutma) handler
  const handleTouchStart = (messageId, e) => {
    if (!onDeleteMessage) return

    // Tüm mesajlar silinebilir (gelen ve giden)
    const msg = messages.find(m => m.id === messageId)
    if (!msg) return

    // Long press timer başlat (500ms)
    longPressTimerRef.current = setTimeout(() => {
      setLongPressMessageId(messageId)
      // Haptic feedback (eğer destekleniyorsa)
      if (navigator.vibrate) {
        navigator.vibrate(50)
      }
    }, 500)
  }

  const handleTouchEnd = (e) => {
    // Timer'ı temizle
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleTouchMove = (e) => {
    // Kullanıcı parmağını hareket ettirirse long press'i iptal et
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleDeleteMessage = (messageId) => {
    if (!onDeleteMessage) return

    // Mobilde direkt sil
    if (isMobile) {
      onDeleteMessage(messageId)
      setLongPressMessageId(null)
    } else {
      // Masaüstünde onay modalı göster
      setDeleteConfirmMessageId(messageId)
      setLongPressMessageId(null)
    }
  }

  const handleCancelDelete = () => {
    setLongPressMessageId(null)
  }

  const handleConfirmDelete = () => {
    if (onDeleteMessage && deleteConfirmMessageId) {
      onDeleteMessage(deleteConfirmMessageId)
      setDeleteConfirmMessageId(null)
    }
  }

  const handleCancelConfirmDelete = () => {
    setDeleteConfirmMessageId(null)
  }

  // Emoji'leri tespit edip daha büyük göster
  const renderMessageWithEmojis = (text) => {
    if (!text || typeof text !== 'string') return text || ''

    // Unicode property escapes ile emoji regex (modern tarayıcılar)
    let emojiRegex
    try {
      emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/gu
    } catch (e) {
      // Fallback: Geniş emoji range
      emojiRegex = /([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{2190}-\u{21FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}-\u{2B55}]|[\u{3030}-\u{303F}]|[\u{3299}-\u{3299}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]|[\u{20E3}]|[\u{FE0F}])+/gu
    }

    const parts = []
    let lastIndex = 0
    let keyCounter = 0

    // Regex'i sıfırla
    emojiRegex.lastIndex = 0

    // Tüm eşleşmeleri bul
    const matches = []
    let match
    while ((match = emojiRegex.exec(text)) !== null) {
      matches.push({
        index: match.index,
        text: match[0],
        length: match[0].length
      })
    }

    // Eğer hiç emoji yoksa, orijinal text'i döndür
    if (matches.length === 0) {
      return text
    }

    // Eşleşmeleri işle
    matches.forEach((matchData) => {
      // Emoji'den önceki metni ekle
      if (matchData.index > lastIndex) {
        const beforeText = text.substring(lastIndex, matchData.index)
        if (beforeText) {
          parts.push(beforeText)
        }
      }

      // Emoji'yi büyük göster
      parts.push(
        <span key={`emoji-${keyCounter++}`} className="inline-block text-[1.7em] leading-none align-middle mx-0.5">
          {matchData.text}
        </span>
      )

      lastIndex = matchData.index + matchData.length
    })

    // Kalan metni ekle
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex)
      if (remainingText) {
        parts.push(remainingText)
      }
    }

    // Eğer parts boşsa, orijinal text'i döndür
    return parts.length > 0 ? parts : text
  }

  const getRoomDisplayName = (room) => {
    if (room.type === 'dm' && room.otherUser) {
      return room.otherUser.username || room.otherUser.email?.split('@')[0] || 'Bilinmeyen Kullanıcı'
    }
    // DM odalarında "DM:" prefix'ini kaldır
    if (room.type === 'dm') {
      return room.name.replace(/^DM:\s*/i, '')
    }
    return room.name
  }

  const getRoomAvatar = (room) => {
    if (room.type === 'dm' && room.otherUser) {
      return room.otherUser.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(room.otherUser.username || room.otherUser.email)}`
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(room.name)}`
  }

  // Son görülme zamanını formatla
  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Bilinmiyor'

    const now = new Date()
    const seen = new Date(lastSeen)
    const diffMs = now - seen
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)

    // Son 1 saat içindeyse dakika olarak göster
    if (diffMins < 60) {
      if (diffMins < 1) return 'Şimdi'
      return `${diffMins} dk önce`
    }

    // 1 saatten eskiyse saat formatında göster (örn: 15:55)
    return seen.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-br from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 relative w-full transition-colors"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Top Bar */}
      <header className="h-[64px] md:h-[72px] flex items-center justify-between px-4 md:px-6 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 shrink-0 transition-colors">
        <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
          <button
            onClick={onBack}
            className="md:hidden p-2 -ml-2 text-gray-400 hover:text-slate-600 active:bg-gray-100 rounded-full transition-all"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="relative shrink-0">
            <img
              src={getRoomAvatar(selectedRoom)}
              className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover"
              alt={getRoomDisplayName(selectedRoom)}
            />
          </div>

          <div className="overflow-hidden">
            <h2 className="font-bold text-slate-900 dark:text-white leading-tight truncate text-sm md:text-base">
              {getRoomDisplayName(selectedRoom)}
            </h2>
            {/* DM odalarında online/offline durumu */}
            {selectedRoom.type === 'dm' && selectedRoom.otherUser && (() => {
              const presence = userPresence.get(selectedRoom.otherUser.id)
              const isOnline = presence?.online || false
              // Eğer presence bilgisi yoksa, son mesajın zamanını kullan
              let lastSeen = presence?.last_seen
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
                      <span>Online</span>
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
          <button className="p-2 hover:text-slate-600 transition-colors">
            <MoreHorizontal size={18} className="md:w-5 md:h-5" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 space-y-4 flex flex-col transition-all"
      >
        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin inline-block w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full mb-2"></div>
              <p className="text-gray-500 text-sm">Mesajlar yükleniyor...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <div className="text-6xl mb-4">💬</div>
              <p className="text-lg font-medium">Henüz mesaj yok</p>
              <p className="text-sm mt-2">İlk mesajı sen gönder!</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender === 'me' || (session && msg.user_id === session.user.id)
            const senderName = msg.user?.username || msg.user?.email?.split('@')[0] || 'Bilinmeyen'
            const isGroupChat = selectedRoom?.type === 'private'

            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] md:max-w-[70%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
              >
                {/* Grup mesajlarında gönderen bilgisi */}
                {!isMe && isGroupChat && (
                  <div className="flex items-center gap-2 mb-1 px-2">
                    {msg.user && (
                      <img
                        src={msg.user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}`}
                        className="w-5 h-5 md:w-6 md:h-6 rounded-full"
                        alt={senderName}
                      />
                    )}
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-500">{senderName}</span>
                  </div>
                )}

                {/* Mesaj balonu */}
                <div className="flex items-end gap-2">
                  <div
                    className={`message-bubble w-full px-3 py-2 md:px-4 md:py-2.5 rounded-2xl text-[13px] md:text-sm shadow-sm transition-all hover:shadow-md group relative min-h-[2rem] flex flex-col justify-center ${isMe
                      ? 'bg-sky-500 text-white rounded-br-none'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-gray-200 rounded-bl-none border border-gray-100 dark:border-slate-700'
                      } ${longPressMessageId === msg.id ? 'ring-2 ring-red-500 ring-offset-2' : ''}`}
                    onTouchStart={(e) => handleTouchStart(msg.id, e)}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                    onTouchCancel={handleTouchEnd}
                  >
                    <div className="break-words whitespace-pre-wrap w-full block">
                      {msg.message_type === 'image' && msg.file_url ? (
                        <div className="mb-1 relative group block rounded-lg overflow-hidden max-w-[240px] md:max-w-sm">
                          <img
                            src={msg.file_url}
                            alt="Shared image"
                            className="max-w-full md:max-w-[300px] max-h-[200px] md:max-h-[300px] rounded-lg object-cover cursor-pointer hover:opacity-95 transition-all"
                            onClick={() => setPreviewImage(msg.file_url)}
                          />
                          {/* Mobile-visible Always size label */}
                          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/50 text-[9px] text-white rounded backdrop-blur-sm sm:hidden pointer-events-none">
                            {formatBytes(msg.file_size)}
                          </div>
                        </div>
                      ) : msg.message_type === 'file' && msg.file_url ? (
                        <div className="flex items-center gap-3 py-1 max-w-full">
                          <div className="w-10 h-10 bg-sky-50 dark:bg-sky-900/30 rounded-xl flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-sky-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold truncate max-w-[150px] sm:max-w-[200px] ${isMe ? 'text-white' : 'text-slate-900 dark:text-gray-100'}`}>
                              {msg.file_name || 'Dosya'}
                            </p>
                            <p className={`text-[10px] font-bold uppercase tracking-wider ${isMe ? 'text-sky-100' : 'text-slate-400 dark:text-gray-500'}`}>
                              {formatBytes(msg.file_size)}
                            </p>
                          </div>
                          <a
                            href={`${msg.file_url}${msg.file_url.includes('?') ? '&' : '?'}download=${encodeURIComponent(msg.file_name || 'file')}`}
                            download={msg.file_name || 'file'}
                            className={`p-2 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded-full transition-all shrink-0 ${isMe ? 'text-white/80 hover:text-white' : 'text-slate-900 dark:text-gray-100 hover:text-sky-600'}`}
                            title="İndir"
                            onClick={(e) => {
                              // Force download by preventing default if needed, 
                              // but standard download attribute usually handles it
                            }}
                          >
                            <Download size={18} />
                          </a>
                        </div>
                      ) : null}

                      {(() => {
                        const content = msg.content || msg.text || ''
                        // Avoid showing empty text bubble if only file is sent
                        if (!content && (msg.file_url)) return null

                        const rendered = renderMessageWithEmojis(content)
                        if (Array.isArray(rendered) && rendered.length === 0) return content || '\u00A0'
                        if (!rendered) return content || '\u00A0'
                        return rendered
                      })()}
                    </div>
                    {/* Desktop: Hover ile silme butonu */}
                    {onDeleteMessage && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteMessage(msg.id)
                        }}
                        className={`absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hidden md:block ${isMe
                          ? 'bg-red-500 text-white hover:bg-red-600'
                          : 'bg-red-500 text-white hover:bg-red-600'
                          }`}
                        title="Mesajı sil"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Mobil: Long press sonrası silme menüsü */}
                {
                  longPressMessageId === msg.id && (
                    <div className="mt-2 flex gap-2 md:hidden">
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold shadow-lg active:scale-95 transition-transform"
                      >
                        Sil
                      </button>
                      <button
                        onClick={handleCancelDelete}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold shadow-lg active:scale-95 transition-transform"
                      >
                        İptal
                      </button>
                    </div>
                  )
                }

                {/* Zaman damgası */}
                <span className="text-[9px] md:text-[10px] text-gray-400 px-2 flex items-center gap-1 mt-0.5">
                  {new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                  {isMe && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '900',
                        color: msg.status === 'read' ? '#0099ffff' : '#9CA3AF',
                        textShadow: msg.status === 'read' ? '0 0 3px #0099ffff' : 'none',
                        marginLeft: '3px',
                        display: 'inline-block'
                      }}
                    >
                      ✓
                    </span>
                  )}
                </span>
              </div>
            )
          })
        )}

        {/* Pagination indicators */}
        {isLoadingMoreMessages && (
          <div className="flex justify-center py-2">
            <div className="flex items-center gap-2 text-sky-500 font-bold text-xs animate-pulse">
              <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
              <span>Eski mesajlar yükleniyor...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />

        {/* Typing Indicator */}
        {typingUsers.size > 0 && selectedRoom && (
          <div className="px-4 py-1 text-xs text-gray-400 dark:text-gray-500 italic animate-pulse">
            {(() => {
              const names = Array.from(typingUsers.values())
              if (names.length === 0) return ''
              if (names.length === 1) return `${names[0]} yazıyor...`
              if (names.length === 2) return `${names[0]} ve ${names[1]} yazıyor...`
              return `${names[0]}, ${names[1]} ve ${names.length - 2} kişi daha yazıyor...`
            })()}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="h-[72px] md:h-[80px] px-2 md:px-6 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 shrink-0 relative flex items-center transition-colors overflow-hidden">
        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-full right-2 md:right-6 mb-2 z-50 shadow-2xl rounded-lg overflow-hidden border border-gray-100 dark:border-slate-800"
            style={{ width: isMobile ? 'calc(100vw - 2rem)' : '352px' }}
          >
            <Picker
              data={data}
              onEmojiSelect={handleEmojiSelect}
              theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
              locale="tr"
              previewPosition="none"
              skinTonePosition="search"
            />
          </div>
        )}

        <div className="w-full max-w-full overflow-hidden flex items-center gap-2 md:gap-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl px-3 md:px-4 py-1.5 border border-gray-200 dark:border-slate-700 focus-within:border-sky-300 dark:focus-within:border-sky-700 focus-within:ring-2 focus-within:ring-sky-100 dark:focus-within:ring-sky-900/30 transition-all">

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Selected File Preview */}
          {selectedFile && (
            <div className="absolute bottom-full left-0 mb-4 ml-2 md:ml-4 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-3 flex items-center gap-4 shadow-2xl z-40 animate-in slide-in-from-bottom-2">
              <div className="bg-sky-50 dark:bg-sky-900/30 p-2.5 rounded-xl text-sky-500">
                {selectedFile.type.startsWith('image/') ? <ImageIcon size={24} /> : <FileIcon size={24} />}
              </div>
              <div className="flex flex-col max-w-[150px] md:max-w-md">
                <span className="text-sm font-bold text-slate-800 dark:text-white truncate">{selectedFile.name}</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">{formatBytes(selectedFile.size)}</span>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full text-gray-400 hover:text-red-500 transition-all"
              >
                <X size={18} />
              </button>
            </div>
          )}

          <input
            type="text"
            placeholder="Mesaj yaz..."
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            className="flex-1 bg-transparent border-none focus:ring-0 text-[13px] md:text-sm py-2 text-slate-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none"
          />

          <div className="flex items-center gap-1 md:gap-2">
            {/* Attachment Button */}
            <button
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className={`p-1.5 rounded-full hover:bg-white dark:hover:bg-slate-700 transition-all ${showAttachMenu ? 'text-sky-500 bg-white dark:bg-slate-700' : 'text-gray-400 dark:text-gray-500 hover:text-sky-500'}`}
              title="Dosya Ekle"
            >
              <Paperclip size={20} />
            </button>

            {/* Attachment Menu */}
            {showAttachMenu && (
              <div className="absolute bottom-full right-2 md:right-6 mb-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-100 dark:border-slate-700 p-2 flex flex-col gap-1 min-w-[140px] z-50 animate-in fade-in slide-in-from-bottom-2">
                <button
                  onClick={() => {
                    setShowAttachMenu(false)
                    fileInputRef.current.accept = "image/*"
                    fileInputRef.current.click()
                  }}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-md text-sm text-gray-700 dark:text-gray-200 transition-colors w-full text-left font-medium"
                >
                  <ImageIcon size={16} className="text-purple-500" />
                  <span>Görsel Gönder</span>
                </button>
                <button
                  onClick={() => {
                    setShowAttachMenu(false)
                    fileInputRef.current.accept = "*/*"
                    fileInputRef.current.click()
                  }}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-md text-sm text-gray-700 dark:text-gray-200 transition-colors w-full text-left font-medium"
                >
                  <FileIcon size={16} className="text-blue-500" />
                  <span>Dosya Gönder</span>
                </button>
              </div>
            )}

            <button
              data-emoji-button
              onClick={toggleEmojiPicker}
              className={`p-1.5 rounded-full hover:bg-white dark:hover:bg-slate-700 transition-all ${showEmojiPicker ? 'text-yellow-500 bg-white dark:bg-slate-700' : 'text-gray-400 dark:text-gray-500 hover:text-yellow-500'}`}
            >
              <Smile size={20} />
            </button>
            <button
              onClick={handleSend}
              disabled={(!inputValue.trim() && !selectedFile) || isUploading}
              className={`p-1.5 md:p-2 rounded-lg transition-all active:scale-95 flex items-center justify-center min-w-[36px] md:min-w-[40px] ${(inputValue.trim() || selectedFile) && !isUploading
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-100 dark:shadow-none hover:bg-sky-600'
                : 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                }`}
            >
              {isUploading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Send size={18} className="md:w-5 md:h-5 translate-x-0.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {deleteConfirmMessageId && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] animate-in fade-in duration-200"
          onClick={handleCancelConfirmDelete}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-sm w-full mx-4 shadow-2xl border border-gray-100 dark:border-slate-800 scale-in-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-4">
                <X size={32} className="text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Mesajı Sil</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-medium">Bu mesajı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.</p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={handleCancelConfirmDelete}
                  className="flex-1 py-3 bg-gray-100 dark:bg-slate-800 text-slate-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-slate-700 transition-all text-sm"
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-100 dark:shadow-none text-sm"
                >
                  Evet, Sil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-[300] animate-in fade-in duration-300"
          onClick={() => setPreviewImage(null)}
        >
          <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/50 to-transparent flex items-center justify-between px-6 z-10">
            <div className="text-white/70 text-sm font-medium">Görsel Önizleme</div>
            <div className="flex items-center gap-3">
              <button
                className="p-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all"
                onClick={async (e) => {
                  e.stopPropagation()
                  try {
                    const response = await fetch(previewImage)
                    const blob = await response.blob()
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = previewImage.split('/').pop() || 'chat_image'
                    document.body.appendChild(a)
                    a.click()
                    window.URL.revokeObjectURL(url)
                    document.body.removeChild(a)
                  } catch (err) {
                    window.open(previewImage, '_blank')
                  }
                }}
                title="İndir"
              >
                <Download size={24} />
              </button>
              <button
                className="p-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all"
                onClick={() => setPreviewImage(null)}
                title="Kapat"
              >
                <X size={24} />
              </button>
            </div>
          </div>
          <img
            src={previewImage}
            className="max-w-full max-h-full object-contain shadow-2xl animate-in zoom-in-95 duration-300"
            alt="Full size preview"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-sky-500/10 dark:bg-sky-500/20 backdrop-blur-sm flex items-center justify-center z-[150] border-4 border-dashed border-sky-500 m-4 rounded-3xl pointer-events-none animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-10 flex flex-col items-center gap-4 scale-in-center">
            <div className="w-20 h-20 bg-sky-50 dark:bg-sky-900/30 rounded-full flex items-center justify-center animate-bounce">
              <Download size={40} className="text-sky-500" />
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-slate-800 dark:text-white mb-1">Dosyayı Buraya Bırak</p>
              <p className="text-sm font-bold text-sky-500 uppercase tracking-widest">Yüklemek için hazır</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
