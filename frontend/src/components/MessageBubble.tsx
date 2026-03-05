import { Download, FileText } from 'lucide-react'
import { Message, User } from '../types'

interface MessageBubbleProps {
    msg: Message | any
    isMe: boolean
    isGroupChat: boolean
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

export default function MessageBubble({
    msg,
    isMe,
    isGroupChat,
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
}: MessageBubbleProps) {
    const senderName = msg.user?.username || msg.user?.email?.split('@')[0] || 'Bilinmeyen'

    const formatBytes = (bytes: number | undefined | null, decimals = 1) => {
        if (!bytes) return '0 Bytes'
        const k = 1024
        const dm = decimals < 0 ? 0 : decimals
        const sizes = ['Bayt', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
    }

    const renderMessageWithEmojis = (text: string) => {
        if (!text || typeof text !== 'string') return text || ''

        let emojiRegex
        try {
            emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/gu
        } catch {
            emojiRegex = /([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{2190}-\u{21FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}-\u{2B55}]|[\u{3030}-\u{303F}]|[\u{3299}-\u{3299}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]|[\u{20E3}]|[\u{FE0F}])+/gu
        }

        const parts = []
        let lastIndex = 0
        let keyCounter = 0

        emojiRegex.lastIndex = 0

        const matches = []
        let match
        while ((match = emojiRegex.exec(text)) !== null) {
            matches.push({
                index: match.index,
                text: match[0],
                length: match[0].length
            })
        }

        if (matches.length === 0) {
            return text
        }

        matches.forEach((matchData) => {
            if (matchData.index > lastIndex) {
                const beforeText = text.substring(lastIndex, matchData.index)
                if (beforeText) {
                    parts.push(beforeText)
                }
            }

            parts.push(
                <span key={`emoji-${keyCounter++}`} className="inline-block text-[1.7em] leading-none align-middle mx-0.5">
                    {matchData.text}
                </span>
            )

            lastIndex = matchData.index + matchData.length
        })

        if (lastIndex < text.length) {
            const remainingText = text.substring(lastIndex)
            if (remainingText) {
                parts.push(remainingText)
            }
        }

        return parts.length > 0 ? parts : text
    }

    return (
        <div
            className={`flex flex-col max-w-[85%] md:max-w-[70%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
        >
            {/* Grup mesajlarında gönderen bilgisi */}
            {!isMe && isGroupChat && (
                <div className="flex items-center gap-2 mb-1 px-2">
                    <span
                        className="text-xs font-semibold text-gray-600 dark:text-gray-500 cursor-pointer hover:underline"
                        onClick={() => msg.user && onUserClick(msg.user)}
                    >
                        {senderName}
                    </span>
                </div>
            )}

            {/* Mesaj balonu */}
            <div className="flex items-end gap-2">
                <div
                    className={`message-bubble w-full px-3 py-2 md:px-4 md:py-2.5 rounded-2xl text-[13px] md:text-sm shadow-sm transition-all hover:shadow-md group relative min-h-[2rem] flex flex-col justify-center ${isMe
                        ? 'bg-sky-500 text-white rounded-br-none'
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-gray-200 rounded-bl-none border border-gray-100 dark:border-slate-700'
                        } ${longPressMessageId === msg.id ? 'ring-2 ring-red-500 ring-offset-2' : ''} ${isMobile ? 'select-none touch-manipulation' : ''}`}
                    onTouchStart={(e) => handleTouchStart(msg.id, e)}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                    onTouchCancel={handleTouchEnd}
                    onContextMenu={(e) => {
                        if (isMobile) {
                            e.preventDefault()
                        }
                    }}
                >
                    <div className="break-words whitespace-pre-wrap w-full block">
                        {msg.message_type === 'image' && msg.file_url ? (
                            <div className="mb-1 relative group block rounded-lg overflow-hidden max-w-[240px] md:max-w-sm">
                                <img
                                    src={msg.file_url}
                                    alt="Shared image"
                                    className="max-w-full md:max-w-[300px] max-h-[200px] md:max-h-[300px] rounded-lg object-cover cursor-pointer hover:opacity-95 transition-all"
                                    onClick={() => setPreviewImage(msg.file_url || null)}
                                    onLoad={() => {
                                        // Trigger a scroll update if this component is at the bottom
                                        if (typeof window !== 'undefined') {
                                            window.dispatchEvent(new Event('chat-image-loaded'));
                                        }
                                    }}
                                />
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
                                    onClick={() => {
                                    }}
                                >
                                    <Download size={18} />
                                </a>
                            </div>
                        ) : null}

                        {(() => {
                            const content = msg.content || (msg as any).text || ''
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
}
