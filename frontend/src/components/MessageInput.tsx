import { Paperclip, Smile, Send, Image as ImageIcon, File as FileIcon, X } from 'lucide-react'
import Picker from '@emoji-mart/react'
import data from '@emoji-mart/data'
import { MutableRefObject } from 'react'

interface MessageInputProps {
    inputValue: string
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    handleKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void
    handleSend: () => void
    isUploading: boolean
    selectedFile: File | null
    setSelectedFile: (file: File | null) => void
    showAttachMenu: boolean
    setShowAttachMenu: (show: boolean) => void
    showEmojiPicker: boolean
    toggleEmojiPicker: () => void
    handleEmojiSelect: (emoji: any) => void
    fileInputRef: MutableRefObject<HTMLInputElement | null>
    handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
    emojiPickerRef: MutableRefObject<HTMLDivElement | null>
    attachMenuRef: MutableRefObject<HTMLDivElement | null>
    isMobile: boolean
}

export default function MessageInput({
    inputValue,
    handleInputChange,
    handleKeyPress,
    handleSend,
    isUploading,
    selectedFile,
    setSelectedFile,
    showAttachMenu,
    setShowAttachMenu,
    showEmojiPicker,
    toggleEmojiPicker,
    handleEmojiSelect,
    fileInputRef,
    handleFileSelect,
    emojiPickerRef,
    attachMenuRef,
    isMobile
}: MessageInputProps) {
    const formatBytes = (bytes: number | undefined | null, decimals = 1) => {
        if (!bytes) return '0 Bytes'
        const k = 1024
        const dm = decimals < 0 ? 0 : decimals
        const sizes = ['Bayt', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
    }

    return (
        <div className="h-[72px] md:h-[80px] px-2 md:px-6 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 shrink-0 relative flex items-center">
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

            <div className="w-full max-w-full flex items-center gap-2 md:gap-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl px-3 md:px-4 py-1.5 border border-gray-200 dark:border-slate-700 focus-within:border-sky-300 dark:focus-within:border-sky-700 focus-within:ring-2 focus-within:ring-sky-100 dark:focus-within:ring-sky-900/30 transition-all">

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
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full text-gray-400 hover:text-red-500 transition-all focus:outline-none focus:ring-2 focus:ring-red-500"
                            aria-label="Seçili dosyayı kaldır"
                        >
                            <X size={18} aria-hidden="true" />
                        </button>
                    </div>
                )}

                <input
                    type="text"
                    placeholder="Mesaj yaz..."
                    aria-label="Mesaj yazma alanı"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyPress}
                    className="flex-1 bg-transparent border-none focus:ring-0 text-[13px] md:text-sm py-2 text-slate-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none"
                />

                <div className="flex items-center gap-1 md:gap-2">
                    {/* Attachment Button */}
                    <button
                        data-attach-button
                        onClick={() => setShowAttachMenu(!showAttachMenu)}
                        aria-expanded={showAttachMenu}
                        aria-haspopup="menu"
                        aria-label="Dosya Ekleme Menüsünü Aç"
                        className={`p-1.5 rounded-full hover:bg-white dark:hover:bg-slate-700 transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 ${showAttachMenu ? 'text-sky-500 bg-white dark:bg-slate-700' : 'text-gray-400 dark:text-gray-500 hover:text-sky-500'}`}
                        title="Dosya Ekle"
                    >
                        <Paperclip size={20} aria-hidden="true" />
                    </button>

                    {/* Attachment Menu */}
                    {showAttachMenu && (
                        <div
                            ref={attachMenuRef}
                            role="menu"
                            aria-label="Dosya Ekleme Seçenekleri"
                            className="absolute bottom-full right-2 md:right-6 mb-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-100 dark:border-slate-700 p-2 flex flex-col gap-1 min-w-[140px] z-50 animate-in fade-in slide-in-from-bottom-2"
                        >
                            <button
                                role="menuitem"
                                onClick={() => {
                                    setShowAttachMenu(false)
                                    if (fileInputRef.current) {
                                        fileInputRef.current.accept = "image/*"
                                        fileInputRef.current.click()
                                    }
                                }}
                                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-md text-sm text-gray-700 dark:text-gray-200 transition-colors w-full text-left font-medium focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-600"
                            >
                                <ImageIcon size={16} className="text-purple-500" aria-hidden="true" />
                                <span>Görsel Gönder</span>
                            </button>
                            <button
                                role="menuitem"
                                onClick={() => {
                                    setShowAttachMenu(false)
                                    if (fileInputRef.current) {
                                        fileInputRef.current.accept = "*/*"
                                        fileInputRef.current.click()
                                    }
                                }}
                                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-md text-sm text-gray-700 dark:text-gray-200 transition-colors w-full text-left font-medium focus:outline-none focus:bg-gray-100 dark:focus:bg-slate-600"
                            >
                                <FileIcon size={16} className="text-blue-500" aria-hidden="true" />
                                <span>Dosya Gönder</span>
                            </button>
                        </div>
                    )}

                    <button
                        data-emoji-button
                        onClick={toggleEmojiPicker}
                        aria-expanded={showEmojiPicker}
                        aria-label="Emoji Seçiciyi Aç"
                        className={`p-1.5 rounded-full hover:bg-white dark:hover:bg-slate-700 transition-all focus:outline-none focus:ring-2 focus:ring-yellow-500 ${showEmojiPicker ? 'text-yellow-500 bg-white dark:bg-slate-700' : 'text-gray-400 dark:text-gray-500 hover:text-yellow-500'}`}
                    >
                        <Smile size={20} aria-hidden="true" />
                    </button>
                    <button
                        onClick={handleSend}
                        aria-label="Mesajı Gönder"
                        disabled={(!inputValue.trim() && !selectedFile) || isUploading}
                        className={`p-1.5 md:p-2 rounded-lg transition-all active:scale-95 flex items-center justify-center min-w-[36px] md:min-w-[40px] focus:outline-none focus:ring-2 focus:ring-sky-500 ${(inputValue.trim() || selectedFile) && !isUploading
                            ? 'bg-sky-500 text-white shadow-lg shadow-sky-100 dark:shadow-none hover:bg-sky-600'
                            : 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                            }`}
                    >
                        {isUploading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-label="Yükleniyor"></div>
                        ) : (
                            <Send size={18} className="md:w-5 md:h-5 translate-x-0.5" aria-hidden="true" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
