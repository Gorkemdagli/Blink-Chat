import { useState, useRef, useEffect } from 'react'
import { X, Download } from 'lucide-react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'
import { getSocket } from '../socket'
import { Room, Message, User } from '../types'
import ProfileModal from './ProfileModal'
import ChatHeader from './ChatHeader'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import GroupInfoModal from './GroupInfoModal'

interface ChatWindowProps {
  selectedRoom: Room
  messages: Message[]
  onSendMessage: (text: string, fileUrl: string | null, messageType: string, fileName: string | null, fileSize: number | null) => void
  onBack: () => void
  isLoadingMessages?: boolean
  isLoadingMoreMessages?: boolean
  hasMoreMessages?: boolean
  onInviteClick?: () => void
  onDeleteMessage?: (messageId: string) => void
  onLoadMoreMessages?: () => Promise<void>
  session: Session
  userPresence?: Map<string, { online: boolean; lastSeen: string }>
  lastMessages?: { [key: string]: Message }
  currentUser?: User | null
  darkMode?: boolean
  onLeaveGroup?: () => void
  onDeleteRoom?: (roomId: string) => void
  onRemoveFriend?: (userId: string) => void
  onAddFriend?: (userCode: string) => Promise<{ success: boolean; error?: string }>
  friends?: User[]
  onProfileUpdate?: (user: User) => void
  onRoomUpdate?: () => void
  showToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

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
  currentUser,
  onLeaveGroup,
  onDeleteRoom,
  onRemoveFriend,
  onAddFriend,
  friends = [],
  onProfileUpdate,
  onRoomUpdate,
  showToast
}: ChatWindowProps) {
  const [inputValue, setInputValue] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [longPressMessageId, setLongPressMessageId] = useState<string | null>(null)
  const [deleteConfirmMessageId, setDeleteConfirmMessageId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isInitialLoadRef = useRef(true)
  const previousRoomIdRef = useRef<string | null>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const attachMenuRef = useRef<HTMLDivElement>(null)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map())
  const [showScrollButton, setShowScrollButton] = useState(false)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Profile Modal State
  const [selectedUserProfile, setSelectedUserProfile] = useState<User | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)

  // Group Info Modal State
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false)

  const handleUserClick = (user: User) => {
    setSelectedUserProfile(user)
    setShowProfileModal(true)
  }

  // Ref for messages to use in effect without dependency
  const messagesRef = useRef(messages)
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Helper to get presence/last seen for any user
  const getUserPresence = (userId: string) => {
    return userPresence.get(userId)
  }

  // Socket Listener for Typing & Read Receipts
  useEffect(() => {
    if (!selectedRoom) return

    const socket = getSocket()
    if (!socket) return

    const handleTyping = ({ userId, username, isTyping }: { userId: string, username: string, isTyping: boolean }) => {
      setTypingUsers(prev => {
        const newMap = new Map(prev)
        if (isTyping) {
          newMap.set(userId, username || 'Someone')
        } else {
          newMap.delete(userId)
        }
        return newMap
      })
    }

    // Typing listeners
    socket.on('typing', ({ userId, username, isTyping }) => handleTyping({ userId, username, isTyping: isTyping }))
    socket.on('stop_typing', ({ userId: _userId }) => handleTyping({ userId: _userId, isTyping: false } as any))

    // Mark Read on mount or active
    const markRead = () => {
      if (messagesRef.current.length > 0 && document.visibilityState === 'visible') {
        const hasUnread = messagesRef.current.some(m => m.user_id !== session.user.id && m.status !== 'read')
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  // Mobil kontrolü ve klavye/boyut değişiminde scroll
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    const handleResizeOrImageLoad = () => {
      checkMobile()
      // Eğer kullanıcı zaten en alttaysa veya benden bir mesaj geldiyse scroll'u koru
      if (scrollRef.current) {
        const container = scrollRef.current
        const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200
        if (isAtBottom) {
          container.scrollTop = container.scrollHeight
        }
      }
    }

    checkMobile()
    window.addEventListener('resize', handleResizeOrImageLoad)
    window.addEventListener('chat-image-loaded', handleResizeOrImageLoad)

    return () => {
      window.removeEventListener('resize', handleResizeOrImageLoad)
      window.removeEventListener('chat-image-loaded', handleResizeOrImageLoad)
    }
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
    const handleClickOutside = (event: Event) => {
      if (longPressMessageId && !(event.target as HTMLElement).closest('.message-bubble')) {
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
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        // Smile butonuna tıklanmadıysa kapat
        if (!(event.target as HTMLElement).closest('button[data-emoji-button]')) {
          setShowEmojiPicker(false)
        }
      }
    }

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showEmojiPicker])

  // Ataş menüsü dışına tıklandığında kapat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target as Node)) {
        // Ataş butonuna tıklanmadıysa kapat
        if (!(event.target as HTMLElement).closest('button[data-attach-button]')) {
          setShowAttachMenu(false)
        }
      }
    }

    if (showAttachMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAttachMenu])

  // Oda değiştiğinde scroll'u sıfırla ve en alta git
  useEffect(() => {
    if (selectedRoom?.id !== previousRoomIdRef.current) {
      isInitialLoadRef.current = true
      previousRoomIdRef.current = selectedRoom?.id
      setShowEmojiPicker(false)

      // Oda değiştiğinde scroll'u anında en alta al (birden fazla deneme ile)
      const instantScroll = () => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' })
        }
      }

      instantScroll()
      setTimeout(instantScroll, 50)
      setTimeout(instantScroll, 150)
    }
  }, [selectedRoom?.id])

  // Track the last message ID to distinguish between new messages and historical ones
  const lastMessageIdRef = useRef<string | null>(null)

  // Scroll to bottom: İlk yüklemede ve yeni mesajlarda
  useEffect(() => {
    if (!scrollRef.current) return

    const container = scrollRef.current

    // Loading bittiğinde ve mesajlar varsa en alta git
    if (isInitialLoadRef.current && !isLoadingMessages) {
      if (messages.length > 0) {
        isInitialLoadRef.current = false
        lastMessageIdRef.current = messages[messages.length - 1]?.id

        const forceScroll = () => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' })
          }
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
          }
        }

        requestAnimationFrame(forceScroll)
        setTimeout(forceScroll, 100)
        setTimeout(forceScroll, 300)
      }
      return
    }

    // Yeni mesajlar geldiğinde (Scroll yönetimi)
    if (messages.length > 0 && !isLoadingMessages && !isInitialLoadRef.current && !isLoadingMoreMessages) {
      const lastMessage = messages[messages.length - 1]
      const currentLastId = lastMessage?.id

      // Sadece gerçekten YENİ bir mesaj geldiyse (en sona eklenen id değiştiyse) işlem yap
      if (currentLastId !== lastMessageIdRef.current) {
        const isMyMessage = lastMessage?.user_id === session?.user?.id || (lastMessage as any)?.sender === 'me'
        const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150

        // Eğer mesaj benden geldiyse VEYA kullanıcı zaten en alttaysa aşağı kaydır
        if (isMyMessage || isAtBottom) {
          setTimeout(() => {
            if (messagesEndRef.current) {
              messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
            }
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight
            }
          }, 50)
        }

        lastMessageIdRef.current = currentLastId
      }
    }
  }, [messages, isLoadingMessages, isLoadingMoreMessages, session?.user?.id])

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

      // Scroll to bottom button visibility logic: Show if more than 150px from bottom
      const isUp = container.scrollHeight - container.scrollTop - container.clientHeight > 150
      setShowScrollButton(isUp)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [hasMoreMessages, isLoadingMoreMessages, onLoadMoreMessages])

  const scrollToBottom = () => {
    if (!scrollRef.current) return

    const container = scrollRef.current
    const start = container.scrollTop
    const end = container.scrollHeight - container.clientHeight
    const change = end - start
    const duration = 800 // Slower scroll duration in ms
    let startTime: number | null = null

    const animateScroll = (currentTime: number) => {
      if (!startTime) startTime = currentTime
      const progress = currentTime - startTime

      // Ease-in-out function for a more organic feel
      const easeInOutQuad = (t: number, b: number, c: number, d: number) => {
        t /= d / 2
        if (t < 1) return (c / 2) * t * t + b
        t--
        return (-c / 2) * (t * (t - 2) - 1) + b
      }

      const val = easeInOutQuad(progress, start, change, duration)
      container.scrollTop = val

      if (progress < duration) {
        requestAnimationFrame(animateScroll)
      } else {
        container.scrollTop = end // Ensure exact end
      }
    }

    requestAnimationFrame(animateScroll)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      showToast?.('Dosya boyutu 50MB\'dan büyük olamaz!', 'error')
      return
    }

    setSelectedFile(file)
    setShowAttachMenu(false)
    // Focus back to input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]

      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        showToast?.('Dosya boyutu 50MB\'dan büyük olamaz!', 'error')
        return
      }

      setSelectedFile(file)
    }
  }

  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { error } = await supabase.storage
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

      return publicUrl
    } catch (error) {
      console.error('Error uploading file:', error)
      showToast?.('Dosya yüklenirken hata oluştu!', 'error')
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

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleEmojiSelect = (emoji: any) => {
    setInputValue(prev => prev + emoji.native)
    setShowEmojiPicker(false)
  }

  const toggleEmojiPicker = () => {
    setShowEmojiPicker(prev => !prev)
  }

  // Mobil için long press (basılı tutma) handler
  const handleTouchStart = (messageId: string, _e: React.TouchEvent) => {
    if (!onDeleteMessage) return

    const msg = messages.find(m => m.id === messageId)
    if (!msg) return

    longPressTimerRef.current = setTimeout(() => {
      setLongPressMessageId(messageId)
      if (navigator.vibrate) {
        navigator.vibrate(50)
      }
    }, 500)
  }

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleTouchMove = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleDeleteMessage = (messageId: string) => {
    if (!onDeleteMessage) return

    if (isMobile) {
      onDeleteMessage(messageId)
      setLongPressMessageId(null)
    } else {
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

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-br from-gray-50 to-white dark:from-slate-900 dark:to-slate-900 relative w-full"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <ChatHeader
        selectedRoom={selectedRoom}
        onBack={onBack}
        onUserClick={handleUserClick}
        userPresence={userPresence}
        lastMessages={lastMessages}
        onInviteClick={onInviteClick}
        showMenu={showMenu}
        setShowMenu={setShowMenu}
        onLeaveGroup={onLeaveGroup}
        onGroupClick={selectedRoom.type === 'private' ? () => setShowGroupInfoModal(true) : undefined}
        onDeleteChat={onDeleteRoom ? () => onDeleteRoom(selectedRoom.id) : undefined}
        onRemoveFriend={onRemoveFriend && selectedRoom.otherUser ? () => onRemoveFriend(selectedRoom.otherUser!.id) : undefined}
      />

      <MessageList
        messages={messages}
        selectedRoom={selectedRoom}
        session={session}
        isLoadingMessages={isLoadingMessages}
        isLoadingMoreMessages={isLoadingMoreMessages}
        scrollRef={scrollRef}
        messagesEndRef={messagesEndRef}
        typingUsers={typingUsers}
        showScrollButton={showScrollButton}
        scrollToBottom={scrollToBottom}
        isMobile={isMobile}
        longPressMessageId={longPressMessageId}
        onUserClick={handleUserClick}
        onDeleteMessage={onDeleteMessage}
        handleTouchStart={handleTouchStart}
        handleTouchEnd={handleTouchEnd}
        handleTouchMove={handleTouchMove}
        handleDeleteMessage={handleDeleteMessage}
        handleCancelDelete={handleCancelDelete}
        setPreviewImage={setPreviewImage}
      />

      <MessageInput
        inputValue={inputValue}
        handleInputChange={handleInputChange}
        handleKeyPress={handleKeyPress}
        handleSend={handleSend}
        isUploading={isUploading}
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
        showAttachMenu={showAttachMenu}
        setShowAttachMenu={setShowAttachMenu}
        showEmojiPicker={showEmojiPicker}
        toggleEmojiPicker={toggleEmojiPicker}
        handleEmojiSelect={handleEmojiSelect}
        fileInputRef={fileInputRef}
        handleFileSelect={handleFileSelect}
        emojiPickerRef={emojiPickerRef}
        attachMenuRef={attachMenuRef}
        isMobile={isMobile}
      />

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
                  } catch {
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

      {/* Profile Modal */}
      {selectedUserProfile && (
        <ProfileModal
          user={selectedUserProfile}
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          isOwnProfile={selectedUserProfile.id === session.user.id}
          userPresence={getUserPresence(selectedUserProfile.id)}
          onAddFriend={onAddFriend}
          isFriend={friends.some(f => ((f as any).friend_id || f.id) === selectedUserProfile.id)}
          onUpdate={(updatedUser) => {
            if (onProfileUpdate) onProfileUpdate(updatedUser)
          }}
        />
      )}

      {/* Group Info Modal */}
      {showGroupInfoModal && selectedRoom.type === 'private' && (
        <GroupInfoModal
          room={selectedRoom}
          friends={friends}
          currentUserId={session.user.id}
          isOpen={showGroupInfoModal}
          onClose={() => setShowGroupInfoModal(false)}
          onUpdateRoomAvatar={() => {
            if (onRoomUpdate) onRoomUpdate()
          }}
          onUpdateGroupName={async (newName) => {
            try {
              const { error } = await supabase.from('rooms').update({ name: newName }).eq('id', selectedRoom.id)
              if (error) throw error
              if (onRoomUpdate) onRoomUpdate()
              return true
            } catch (err) {
              console.error('Error updating group name:', err)
              return false
            }
          }}
          onRemoveMember={async (userId) => {
            try {
              const { error } = await supabase.from('room_members').delete().eq('room_id', selectedRoom.id).eq('user_id', userId)
              if (error) throw error
              if (onRoomUpdate) onRoomUpdate()
              return true
            } catch (err) {
              console.error('Error removing member:', err)
              return false
            }
          }}
          onInviteMembers={async (userIds) => {
            try {
              const inserts = userIds.map(id => ({
                room_id: selectedRoom.id,
                inviter_id: session.user.id,
                invitee_id: id,
                status: 'pending'
              }))
              const { error } = await supabase.from('room_invitations').insert(inserts)
              if (error) throw error
              return true
            } catch (err) {
              console.error('Error inviting members:', err)
              return false
            }
          }}
        />
      )}
    </div>
  )
}
