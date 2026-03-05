import { useState } from 'react'
import { X, Check, Search, Users } from 'lucide-react'
import { User } from '../types'

interface CreateGroupModalProps {
    friends: User[]
    onClose: () => void
    onCreateGroup: (groupName: string, selectedUserIds: string[]) => Promise<any>
}

export default function CreateGroupModal({
    friends,
    onClose,
    onCreateGroup
}: CreateGroupModalProps) {
    const [groupName, setGroupName] = useState('')
    const [selectedFriends, setSelectedFriends] = useState<string[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const filteredFriends = friends.filter(friend =>
        (friend.username || friend.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    )

    const toggleFriendSelection = (friendId: string) => {
        setSelectedFriends(prev =>
            prev.includes(friendId)
                ? prev.filter(id => id !== friendId)
                : [...prev, friendId]
        )
    }

    const handleSubmit = async () => {
        if (!groupName.trim()) {
            setError('Lütfen bir grup adı girin')
            return
        }

        if (selectedFriends.length === 0) {
            setError('Lütfen en az bir arkadaş seçin')
            return
        }

        setError('')
        setIsLoading(true)

        try {
            await onCreateGroup(groupName.trim(), selectedFriends)
            onClose()
        } catch (err) {
            console.error('Error creating group:', err)
            setError('Grup oluşturulurken bir hata oluştu')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 dark:border-slate-700 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
                            <Users size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Grup Oluştur</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-slate-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-all"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Group Name Input */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Grup Adı</label>
                        <input
                            type="text"
                            placeholder="Örn: Hafta Sonu Planı"
                            value={groupName}
                            onChange={(e) => {
                                setGroupName(e.target.value)
                                setError('')
                            }}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 text-slate-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
                        />
                    </div>

                    {/* Friends Selection */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Katılımcılar</label>
                            <span className="text-xs text-gray-400">{selectedFriends.length} kişi seçildi</span>
                        </div>

                        {/* Search Friends */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Arkadaş ara..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-all"
                            />
                        </div>

                        {/* Friends List */}
                        <div className="max-h-[240px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                            {filteredFriends.length > 0 ? (
                                filteredFriends.map((friend) => {
                                    const isSelected = selectedFriends.includes(friend.id)
                                    const displayName = friend.username || friend.email?.split('@')[0] || 'Bilinmeyen'

                                    return (
                                        <button
                                            key={friend.id}
                                            onClick={() => toggleFriendSelection(friend.id)}
                                            className={`w-full flex items-center justify-between p-3 rounded-xl transition-all border ${isSelected
                                                ? 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800'
                                                : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-slate-700/50'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <img
                                                        src={friend.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}`}
                                                        alt={displayName}
                                                        className="w-10 h-10 rounded-full object-cover bg-gray-100"
                                                    />
                                                    {isSelected && (
                                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-sky-500 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center">
                                                            <Check size={12} className="text-white" strokeWidth={3} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-left">
                                                    <p className={`text-sm font-semibold ${isSelected ? 'text-sky-700 dark:text-sky-300' : 'text-slate-700 dark:text-gray-300'}`}>
                                                        {displayName}
                                                    </p>
                                                    <p className="text-xs text-gray-400 truncate max-w-[150px]">
                                                        {friend.email}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    )
                                })
                            ) : (
                                <div className="text-center py-8 text-gray-400 text-sm">
                                    {friends.length === 0 ? 'Listenizde hiç arkadaş yok.' : 'Arkadaş bulunamadı.'}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg text-center font-medium animate-in fade-in slide-in-from-top-2">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 pt-0 border-t border-transparent shrink-0">
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className={`w-full py-3.5 text-white font-bold rounded-xl transition-all shadow-lg active:scale-[0.99] flex items-center justify-center gap-2 ${isLoading
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-sky-500 hover:bg-sky-600 shadow-sky-200 dark:shadow-none'
                            }`}
                    >
                        {isLoading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>Oluşturuluyor...</span>
                            </>
                        ) : (
                            'Grubu Oluştur'
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
