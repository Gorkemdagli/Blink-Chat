import { Room, Message, User } from '../types'
import { Session } from '@supabase/supabase-js'
import MessageBubble from './MessageBubble'
import { ChevronDown } from 'lucide-react'
import { MutableRefObject } from 'react'

interface MessageListProps {
    messages: Message[]
    selectedRoom: Room
    session: Session
    isLoadingMessages: boolean
    isLoadingMoreMessages: boolean
    scrollRef: MutableRefObject<HTMLDivElement | null>
    messagesEndRef: MutableRefObject<HTMLDivElement | null>
    typingUsers: Map<string, string>
    showScrollButton: boolean
    scrollToBottom: () => void
    isMobile: boolean
    longPressMessageId: string | null
    onUserClick: (user: User) => void
    onDeleteMessage?: (messageId: string) => void
    handleTouchStart: (messageId: string, e: React.TouchEvent) => void
    handleTouchEnd: () => void
    handleTouchMove: () => void
    handleDeleteMessage: (messageId: string) => void
    handleCancelDelete: () => void
    setPreviewImage: (url: string | null) => void
}

export default function MessageList({
    messages,
    selectedRoom,
    session,
    isLoadingMessages,
    isLoadingMoreMessages,
    scrollRef,
    messagesEndRef,
    typingUsers,
    showScrollButton,
    scrollToBottom,
    isMobile,
    longPressMessageId,
    onUserClick,
    onDeleteMessage,
    handleTouchStart,
    handleTouchEnd,
    handleTouchMove,
    handleDeleteMessage,
    handleCancelDelete,
    setPreviewImage
}: MessageListProps) {
    return (
        <>
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 space-y-4 flex flex-col"
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
                        const isMe = (msg as any).sender === 'me' || (session && msg.user_id === session.user.id)
                        const isGroupChat = selectedRoom?.type === 'private'

                        return (
                            <MessageBubble
                                key={msg.id}
                                msg={msg}
                                isMe={isMe}
                                isGroupChat={isGroupChat}
                                isMobile={isMobile}
                                longPressMessageId={longPressMessageId}
                                onUserClick={onUserClick}
                                onDeleteMessage={onDeleteMessage}
                                handleTouchStart={handleTouchStart}
                                handleTouchEnd={handleTouchEnd}
                                handleTouchMove={handleTouchMove}
                                handleDeleteMessage={handleDeleteMessage}
                                handleCancelDelete={handleCancelDelete}
                                setPreviewImage={setPreviewImage}
                            />
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

            {/* Scroll to Bottom Button */}
            {showScrollButton && (
                <button
                    onClick={scrollToBottom}
                    className="absolute bottom-[90px] md:bottom-[100px] right-6 p-2.5 bg-white dark:bg-slate-800 text-sky-500 rounded-full shadow-xl border border-gray-100 dark:border-slate-700 hover:scale-110 active:scale-95 transition-all z-30 animate-in fade-in slide-in-from-bottom-4"
                    title="En Alta Git"
                >
                    <ChevronDown size={24} strokeWidth={2.5} />
                </button>
            )}
        </>
    )
}
