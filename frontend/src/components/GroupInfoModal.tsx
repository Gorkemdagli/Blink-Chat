import { useState, useRef } from 'react'
import { X, Check, Search, Camera, Shield, UserMinus, UserPlus, Edit2 } from 'lucide-react'
import { Room, User } from '../types'
import { supabase } from '../supabaseClient'
import ConfirmModal from './ConfirmModal'


interface GroupInfoModalProps {
    room: Room
    friends: User[]
    currentUserId: string
    isOpen: boolean
    onClose: () => void
    onUpdateRoomAvatar: (avatarUrl: string) => void
    onUpdateGroupName: (newName: string) => Promise<boolean>
    onRemoveMember: (userId: string) => Promise<boolean>
    onInviteMembers: (userIds: string[]) => Promise<boolean>
}

export default function GroupInfoModal({
    room,
    friends,
    currentUserId,
    isOpen,
    onClose,
    onUpdateRoomAvatar,
    onUpdateGroupName,
    onRemoveMember,
    onInviteMembers
}: GroupInfoModalProps) {
    const [view, setView] = useState<'info' | 'add_members'>('info')
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedFriends, setSelectedFriends] = useState<string[]>([])
    const [invitedUserIds, setInvitedUserIds] = useState<string[]>([])

    // Group Name Edit States
    const [isEditingName, setIsEditingName] = useState(false)
    const [newGroupName, setNewGroupName] = useState(room.name || '')
    const [isUpdatingName, setIsUpdatingName] = useState(false)

    // Avatar Upload States
    const [isUploading, setIsUploading] = useState(false)
    const [uploadError, setUploadError] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Member action states
    const [isProcessing, setIsProcessing] = useState<string | null>(null) // the user id currently being processed
    const [memberToRemove, setMemberToRemove] = useState<any | null>(null)


    if (!isOpen) return null

    const isOwner = room.created_by === currentUserId

    // Calculate members from room data
    const memberItems = room.members as any[] || []

    // Fetch invited users
    useState(() => {
        const fetchInvited = async () => {
            const { data } = await supabase
                .from('room_invitations')
                .select('invitee_id')
                .eq('room_id', room.id)
                .eq('status', 'pending')

            if (data) {
                setInvitedUserIds(data.map(i => i.invitee_id))
            }
        }
        fetchInvited()
    })

    // Filter out friends that are already in the group or invited
    const friendsToInvite = friends.filter(friend => {
        const friendId = (friend as any).friend_id || friend.id
        const isMember = memberItems.some(m => m.user_id === friendId)
        const isInvited = invitedUserIds.includes(friendId)
        return !isMember && !isInvited
    })

    const filteredFriends = friendsToInvite.filter(friend => {
        const name = friend.username || friend.email || ''
        return name.toLowerCase().includes(searchTerm.toLowerCase())
    })

    const handleFileClick = () => {
        if (!isOwner) return
        if (fileInputRef.current) {
            fileInputRef.current.click()
        }
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            setUploadError('Lütfen geçerli bir resim dosyası seçin.')
            return
        }

        if (file.size > 5 * 1024 * 1024) {
            setUploadError('Dosya boyutu 5MB\'dan küçük olmalıdır.')
            return
        }

        setIsUploading(true)
        setUploadError('')

        try {
            const timestamp = Date.now()
            let newFileName = `group-${room.id}-${timestamp}`

            // Remove old group avatar if exists
            if (room.avatar_url) {
                const urlParts = room.avatar_url.split('/avatars/')
                if (urlParts.length > 1) {
                    const oldFilePath = urlParts[1]
                    await supabase.storage.from('avatars').remove([oldFilePath])
                }
            }

            // Upload new group avatar
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(newFileName, file, { cacheControl: '0' })

            if (uploadError) throw uploadError

            // Get new public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(newFileName)

            // Update database room entry
            const { error: updateError } = await supabase
                .from('rooms')
                .update({ avatar_url: publicUrl })
                .eq('id', room.id)

            if (updateError) throw updateError

            onUpdateRoomAvatar(publicUrl)
        } catch (err: any) {
            console.error('Group avatar upload error:', err)
            setUploadError('Fotoğraf yüklenirken bir hata oluştu.')
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    const handleUpdateNameSubmit = async () => {
        if (!newGroupName.trim() || newGroupName === room.name) {
            setIsEditingName(false)
            setNewGroupName(room.name || '')
            return
        }

        setIsUpdatingName(true)
        const success = await onUpdateGroupName(newGroupName.trim())
        if (success) {
            setIsEditingName(false)
        } else {
            setNewGroupName(room.name || '')
        }
        setIsUpdatingName(false)
    }

    const handleRemoveMember = async (userId: string) => {
        if (!isOwner || userId === currentUserId) return

        setIsProcessing(userId)
        await onRemoveMember(userId)
        setIsProcessing(null)
    }

    const toggleFriendSelection = (friendId: string) => {
        setSelectedFriends(prev =>
            prev.includes(friendId)
                ? prev.filter(id => id !== friendId)
                : [...prev, friendId]
        )
    }

    const handleAddMembersSubmit = async () => {
        if (selectedFriends.length === 0) return

        setIsProcessing('inviting')
        const success = await onInviteMembers(selectedFriends)
        if (success) {
            setSelectedFriends([])
            setView('info')
            // Update local invited state
            setInvitedUserIds(prev => [...prev, ...selectedFriends])
        }
        setIsProcessing(null)
    }

    // Default room avatar generating logic
    const getRoomAvatar = () => {
        if (room.avatar_url) return room.avatar_url
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(room.name || 'Grup')}`
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                {view === 'info' && (
                    <>
                        <div className="flex justify-end p-4 pb-0 shrink-0">
                            <button
                                onClick={onClose}
                                className="p-2 text-gray-400 hover:text-slate-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-all z-10"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="px-6 pb-6 text-center shrink-0">
                            <div className="relative inline-block mb-4 group/avatar">
                                <div className={`relative w-28 h-28 mx-auto rounded-full overflow-hidden border-4 border-white dark:border-slate-800 shadow-xl bg-gray-100 ${isOwner ? 'cursor-pointer' : ''}`} onClick={handleFileClick}>
                                    {isUploading ? (
                                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-10">
                                            <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        </div>
                                    ) : (
                                        <>
                                            <img
                                                src={getRoomAvatar()}
                                                alt={room.name || 'Grup'}
                                                className="w-full h-full object-cover"
                                                key={room.avatar_url || 'default'}
                                            />
                                            {isOwner && (
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                                                    <Camera size={24} className="mb-1" />
                                                    <span className="text-[10px] font-bold uppercase tracking-wider">Değiştir</span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept="image/*"
                                className="hidden"
                            />

                            {uploadError && (
                                <p className="text-red-500 text-xs mt-2 font-medium">{uploadError}</p>
                            )}

                            {isEditingName ? (
                                <div className="flex items-center justify-center gap-2 max-w-[280px] mx-auto">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateNameSubmit()}
                                        className="w-full px-3 py-1.5 rounded-lg border border-sky-300 dark:border-sky-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-lg font-bold text-center focus:outline-none"
                                        disabled={isUpdatingName}
                                    />
                                    <button
                                        onClick={handleUpdateNameSubmit}
                                        disabled={isUpdatingName}
                                        className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                                    >
                                        <Check size={18} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsEditingName(false)
                                            setNewGroupName(room.name || '')
                                        }}
                                        disabled={isUpdatingName}
                                        className="p-2 bg-gray-100 dark:bg-slate-700 text-gray-400 rounded-lg hover:text-slate-600 transition-colors"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-2 group/name_container">
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                                        {room.name}
                                    </h2>
                                    {isOwner && (
                                        <button
                                            onClick={() => setIsEditingName(true)}
                                            className="p-1.5 text-gray-300 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded-lg transition-all opacity-0 group-hover/name_container:opacity-100"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    )}
                                </div>
                            )}
                            <p className="text-sm font-medium text-sky-500 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 inline-flex px-3 py-1 rounded-full">
                                {memberItems.length} Üye
                            </p>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                    Grup Üyeleri
                                </h3>
                                {isOwner && (
                                    <button
                                        onClick={() => setView('add_members')}
                                        className="text-xs font-bold text-sky-500 hover:text-sky-600 transition-colors flex items-center gap-1 bg-sky-50 dark:bg-sky-900/30 px-2 py-1.5 rounded-lg"
                                    >
                                        <UserPlus size={14} /> Üye Davet Et
                                    </button>
                                )}
                            </div>

                            <div className="space-y-1">
                                {memberItems.map(member => {
                                    const memberName = member.username || 'Bilinmeyen'
                                    const memberAvatar = member.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(memberName)}`
                                    const isGroupOwner = room.created_by === member.user_id

                                    return (
                                        <div key={member.user_id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-gray-100 dark:border-slate-700/50">
                                            <div className="flex items-center gap-3">
                                                <img src={memberAvatar} alt={memberName} className="w-10 h-10 rounded-full object-cover" />
                                                <div>
                                                    <p className="font-semibold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                                                        {memberName} {member.user_id === currentUserId && <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded ml-1">Sen</span>}
                                                    </p>
                                                    {isGroupOwner && (
                                                        <p className="text-[10px] text-emerald-500 font-bold flex items-center gap-1 mt-0.5">
                                                            <Shield size={10} /> Kurucu
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {isOwner && !isGroupOwner && (
                                                <button
                                                    onClick={() => setMemberToRemove(member)}
                                                    disabled={isProcessing === member.user_id}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                                    title="Gruptan Çıkar"
                                                >
                                                    {isProcessing === member.user_id ? (
                                                        <div className="w-4 h-4 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
                                                    ) : (
                                                        <UserMinus size={18} />
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </>
                )}

                {view === 'add_members' && (
                    <>
                        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 dark:border-slate-700 shrink-0">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setView('info')}
                                    className="p-1 -ml-1 text-gray-400 hover:text-slate-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-all"
                                >
                                    <X size={20} className="rotate-45" /> {/* Arrow icon would be better but X works as 'cancel' */}
                                </button>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Üye Davet Et</h2>
                            </div>
                            <span className="text-xs font-bold text-sky-500 bg-sky-50 dark:bg-sky-900/30 px-2 py-1 rounded-full">
                                {selectedFriends.length} Seçili
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Arkadaş ara..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
                                />
                            </div>

                            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {filteredFriends.length > 0 ? (
                                    filteredFriends.map((friend) => {
                                        const friendId = (friend as any).friend_id || friend.id
                                        const isSelected = selectedFriends.includes(friendId)
                                        const displayName = friend.username || friend.email?.split('@')[0] || 'Bilinmeyen'

                                        return (
                                            <button
                                                key={friendId}
                                                onClick={() => toggleFriendSelection(friendId)}
                                                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all border ${isSelected
                                                    ? 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800'
                                                    : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-slate-700/50 border-b border-gray-100 dark:border-slate-800'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <img
                                                        src={friend.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}`}
                                                        alt={displayName}
                                                        className="w-10 h-10 rounded-full object-cover"
                                                    />
                                                    <div className="text-left">
                                                        <p className={`text-sm font-semibold ${isSelected ? 'text-sky-700 dark:text-sky-300' : 'text-slate-700 dark:text-gray-300'}`}>
                                                            {displayName}
                                                        </p>
                                                    </div>
                                                </div>
                                                {isSelected && (
                                                    <div className="w-6 h-6 bg-sky-500 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center">
                                                        <Check size={14} className="text-white" strokeWidth={3} />
                                                    </div>
                                                )}
                                            </button>
                                        )
                                    })
                                ) : (
                                    <div className="text-center py-8 text-gray-500 text-sm">
                                        Eklenebilecek arkadaş bulunamadı.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 pt-0 shrink-0">
                            <button
                                onClick={handleAddMembersSubmit}
                                disabled={selectedFriends.length === 0 || isProcessing === 'adding'}
                                className={`w-full py-3.5 text-white font-bold rounded-xl transition-all shadow-lg active:scale-[0.99] flex items-center justify-center gap-2 ${selectedFriends.length === 0 || isProcessing === 'adding'
                                    ? 'bg-gray-300 dark:bg-slate-700 cursor-not-allowed text-gray-500 dark:text-gray-400 shadow-none'
                                    : 'bg-sky-500 hover:bg-sky-600 shadow-sky-200 dark:shadow-none'
                                    }`}
                            >
                                {isProcessing === 'inviting' ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Davet Gönderiliyor...</span>
                                    </>
                                ) : (
                                    `Davet Gönder (${selectedFriends.length})`
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Member Removal Confirmation */}
            <ConfirmModal
                isOpen={!!memberToRemove}
                onClose={() => setMemberToRemove(null)}
                onConfirm={() => {
                    if (memberToRemove) {
                        handleRemoveMember(memberToRemove.user_id)
                    }
                }}
                title="Üyeyi Çıkar"
                description={`${memberToRemove?.username} kişisini gruptan çıkarmak istediğinize emin misiniz?`}
                confirmText="Gruptan Çıkar"
                variant="danger"
            />
        </div>
    )
}
