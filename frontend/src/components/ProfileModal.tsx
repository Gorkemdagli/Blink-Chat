import { useState, useRef, useEffect } from 'react'
import { X, Camera, Copy, Check, User, Save, Loader2, UserPlus, Clock, UserMinus } from 'lucide-react'
import { User as UserType } from '../types'
import { supabase } from '../supabaseClient'

interface ProfileModalProps {
    user: UserType
    isOpen: boolean
    onClose: () => void
    onUpdate?: (updatedUser: UserType) => void
    onAddFriend?: (userCode: string) => Promise<{ success: boolean; error?: string }>
    onRemoveFriend?: (userId: string) => void
    isFriend?: boolean
    isOwnProfile?: boolean
    userPresence?: { online: boolean; lastSeen?: string }
}

export default function ProfileModal({
    user,
    isOpen,
    onClose,
    onUpdate,
    onAddFriend,
    onRemoveFriend,
    isOwnProfile = false,
    isFriend = false,
    userPresence
}: ProfileModalProps) {
    const [name, setName] = useState(user.username || '')
    const [bio, setBio] = useState(user.bio || '')
    const [userCode, setUserCode] = useState(user.user_code || '')
    const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || '')
    const [isLoading, setIsLoading] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [copiedCode, setCopiedCode] = useState(false)
    const [error, setError] = useState('')
    const [successMessage, setSuccessMessage] = useState('')

    // Fetch latest user data (bio) when modal opens
    useEffect(() => {
        if (isOpen && user.id) {
            const fetchUserDetails = async () => {
                const { data, error } = await supabase
                    .from('users')
                    .select('bio, username, avatar_url, user_code')
                    .eq('id', user.id)
                    .single()

                if (data && !error) {
                    setBio(data.bio || '')
                    setUserCode(data.user_code || '')
                    if (data.username && data.username !== user.username) setName(data.username)
                    if (data.avatar_url && data.avatar_url !== user.avatar_url) setAvatarUrl(data.avatar_url)
                }
            }
            fetchUserDetails()
        }
    }, [isOpen, user.id])

    // Reset state when user changes or modal opens
    useEffect(() => {
        if (isOpen) {
            setName(user.username || '')
            setUserCode(user.user_code || '')
            setAvatarUrl(user.avatar_url || '')
            // Don't reset bio here immediately if we are fetching it
            // but we set initial state from props.user.bio
            setError('')
            setSuccessMessage('')
        }
    }, [isOpen, user])

    const fileInputRef = useRef<HTMLInputElement>(null)

    if (!isOpen) return null

    const handleCopyCode = async () => {
        const codeToCopy = userCode || user.user_code
        if (codeToCopy) {
            try {
                await navigator.clipboard.writeText(codeToCopy.toString())
                setCopiedCode(true)
                setTimeout(() => setCopiedCode(false), 2000)
            } catch (err) {
                console.error('Failed to copy', err)
            }
        }
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isOwnProfile) return

        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        setError('')

        try {
            // Timestamp verip CDN'i %100 by-pass etmek için dosya adını unique yapıyoruz
            const timestamp = Date.now()
            let newFileName = `profile-${user.user_code || user.id}-${timestamp}`

            // 1. ADIM: EĞER KULLANICININ ESKİ VEYA MEVCUT BİR FOTOĞRAFI VARSA, STORAGE'DAN SİL
            if (user.avatar_url) {
                try {
                    const url = new URL(user.avatar_url)
                    const pathParts = url.pathname.split('/')
                    const bucketIndex = pathParts.indexOf('avatars')
                    if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
                        // Supabase URL'inin içinden resmin tam yolunu (path) çıkarıyoruz
                        // Örneğin: `profile-gorkem-12345678` 
                        const oldFilePath = decodeURIComponent(pathParts.slice(bucketIndex + 1).join('/'))

                        // Storage'daki bu eski dosyayı siliyoruz ("eskisi silinip...")
                        const { error: removeError } = await supabase.storage
                            .from('avatars')
                            .remove([oldFilePath])

                        if (removeError) {
                            console.warn("Eski profil resmi silinirken hata:", removeError)
                        } else {
                            console.log("Eski profil resmi başarıyla Storage'dan silindi:", oldFilePath)
                        }
                    }
                } catch (e) {
                    console.warn("Mevcut avatar URL'si parse edilemedi, silme işlemi atlandı.");
                }
            }

            // 2. ADIM: YENİ FOTOĞRAFI YÜKLE ("...yenisi kalmalı")
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(newFileName, file)

            if (uploadError) throw uploadError

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(newFileName)

            // Add timestamp to force cache refresh in browser without changing actual storage file name
            const publicUrlWithCacheBust = `${publicUrl}?t=${Date.now()}`

            const { data: updateData, error: updateError } = await supabase
                .from('users')
                .update({ avatar_url: publicUrlWithCacheBust })
                .eq('id', user.id)
                .select()

            if (updateError) throw updateError

            if (!updateData || updateData.length === 0) {
                console.error('❌ Database update affected 0 rows. Check RLS policies for public.users table.')
                throw new Error('Veritabanı güncellenemedi (Yetki Hatası)')
            }

            console.log('✅ Database updated successfully:', updateData)

            if (onUpdate) onUpdate({ ...user, avatar_url: publicUrlWithCacheBust })
            setAvatarUrl(publicUrlWithCacheBust)

        } catch (err: any) {
            console.error('Error uploading avatar:', err)
            setError('Profil resmi yüklenirken hata oluştu')
        } finally {
            setIsUploading(false)
        }
    }

    const handleSubmit = async () => {
        if (!isOwnProfile) return

        if (!name.trim()) {
            setError('İsim boş olamaz')
            return
        }

        setIsLoading(true)
        setError('')

        try {
            const { error: updateError } = await supabase
                .from('users')
                .update({
                    username: name.trim(),
                    bio: bio.trim()
                })
                .eq('id', user.id)

            if (updateError) throw updateError

            if (onUpdate) {
                onUpdate({
                    ...user,
                    username: name.trim(),
                    bio: bio.trim()
                })
            }
            onClose()
        } catch (err: any) {
            console.error('Error updating profile:', err)
            setError('Profil güncellenirken hata oluştu')
        } finally {
            setIsLoading(false)
        }
    }

    const handleAddFriendClick = async () => {
        const codeToAdd = userCode || user.user_code
        if (!onAddFriend || !codeToAdd) return

        setIsLoading(true)
        setError('')
        setSuccessMessage('')

        try {
            const result = await onAddFriend(codeToAdd)
            if (result.success) {
                setSuccessMessage('Arkadaşlık isteği gönderildi!')
            } else {
                setError(result.error || 'İstek gönderilemedi')
            }
        } catch (err) {
            console.error('Error adding friend:', err)
            setError('Bir hata oluştu')
        } finally {
            setIsLoading(false)
        }
    }

    // Format last seen date
    const formattedLastSeen = userPresence?.lastSeen
        ? new Date(userPresence.lastSeen).toLocaleString('tr-TR', {
            day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
        })
        : 'Görülmedi'

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 dark:border-slate-700">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        {isOwnProfile ? 'Profil Düzenle' : 'Kullanıcı Profili'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-slate-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-all"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Avatar Section */}
                    <div className="flex flex-col items-center gap-4">
                        <div className={`relative group ${isOwnProfile ? 'cursor-pointer' : ''}`} onClick={() => isOwnProfile && fileInputRef.current?.click()}>
                            <img
                                src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || 'User')}`}
                                alt={user.username}
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.onerror = null;
                                    target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || 'User')}`;
                                }}
                                className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-slate-700 shadow-lg group-hover:opacity-90 transition-opacity bg-white"
                            />
                            {isOwnProfile && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera className="text-white" size={24} />
                                </div>
                            )}
                            {/* Online Status for Other Users */}
                            {!isOwnProfile && userPresence && (
                                <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-white dark:border-slate-800 ${userPresence.online ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                            )}
                            {isUploading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                                    <Loader2 className="text-white animate-spin" size={24} />
                                </div>
                            )}
                        </div>
                        {isOwnProfile && (
                            <>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-sm font-medium text-sky-500 hover:text-sky-600 dark:text-sky-400"
                                >
                                    Fotoğrafı Değiştir
                                </button>
                            </>
                        )}
                        {!isOwnProfile && userPresence && !userPresence.online && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium bg-gray-100 dark:bg-slate-700/50 px-2 py-1 rounded-full">
                                <Clock size={12} />
                                <span>Son görülme: {formattedLastSeen}</span>
                            </div>
                        )}
                    </div>

                    {/* Form Section */}
                    <div className="space-y-4">
                        {/* Name Input */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide ml-1">
                                Görünen İsim
                            </label>
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        readOnly={!isOwnProfile}
                                        className={`w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-gray-400 focus:outline-none transition-all font-medium ${isOwnProfile ? 'bg-gray-50 dark:bg-slate-900/50 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20' : 'bg-transparent border-transparent pl-10'}`}
                                        placeholder="İsim yok"
                                    />
                                </div>
                                {!isOwnProfile && isFriend && onRemoveFriend && (
                                    <button
                                        onClick={() => {
                                            if (confirm('Arkadaşlıktan çıkarmak istediğinize emin misiniz?')) {
                                                onRemoveFriend(user.id);
                                                onClose();
                                            }
                                        }}
                                        className="p-2.5 text-red-500 hover:text-white hover:bg-red-500 bg-red-50 dark:bg-red-900/20 dark:hover:bg-red-500 rounded-xl transition-all"
                                        title="Arkadaşlıktan Çıkar"
                                    >
                                        <UserMinus size={20} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Bio Input */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide ml-1">
                                Hakkımda
                            </label>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                readOnly={!isOwnProfile}
                                className={`w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-gray-400 focus:outline-none transition-all resize-none h-24 ${isOwnProfile ? 'bg-gray-50 dark:bg-slate-900/50 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20' : 'bg-transparent border-transparent px-0'}`}
                                placeholder={isOwnProfile ? "Kendinizden bahsedin..." : "Hakkında bilgisi yok."}
                                maxLength={200}
                            />
                            {isOwnProfile && (
                                <div className="text-right text-xs text-gray-400">
                                    {bio.length}/200
                                </div>
                            )}
                        </div>

                        {/* User Code */}
                        {user.user_code && (
                            <div className="bg-sky-50 dark:bg-sky-900/20 rounded-xl p-3 flex items-center justify-between border border-sky-100 dark:border-sky-800/30">
                                <div className="flex flex-col">
                                    <span className="text-xs text-sky-600 dark:text-sky-400 font-bold uppercase tracking-wider">Arkadaşlık Kodu</span>
                                    <span className="text-lg font-mono font-bold text-slate-900 dark:text-white tracking-widest">#{user.user_code}</span>
                                </div>
                                <button
                                    onClick={handleCopyCode}
                                    className="p-2 hover:bg-sky-100 dark:hover:bg-sky-900/40 rounded-lg transition-colors text-sky-600 dark:text-sky-400"
                                    title="Kodu Kopyala"
                                >
                                    {copiedCode ? <Check size={20} /> : <Copy size={20} />}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Messages */}
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg text-center font-medium animate-in fade-in slide-in-from-top-2">
                            {error}
                        </div>
                    )}
                    {successMessage && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-lg text-center font-medium animate-in fade-in slide-in-from-top-2">
                            {successMessage}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 pt-0">
                    {isOwnProfile ? (
                        <button
                            onClick={handleSubmit}
                            disabled={isLoading || isUploading}
                            className={`w-full py-3.5 text-white font-bold rounded-xl transition-all shadow-lg active:scale-[0.99] flex items-center justify-center gap-2 ${isLoading
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-sky-500 hover:bg-sky-600 shadow-sky-200 dark:shadow-none'
                                }`}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    <span>Kaydediliyor...</span>
                                </>
                            ) : (
                                <>
                                    <Save size={20} />
                                    <span>Kaydet</span>
                                </>
                            )}
                        </button>
                    ) : (
                        onAddFriend && !isFriend && (
                            <button
                                onClick={handleAddFriendClick}
                                disabled={isLoading}
                                className={`w-full py-3.5 text-white font-bold rounded-xl transition-all shadow-lg active:scale-[0.99] flex items-center justify-center gap-2 ${isLoading
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-sky-500 hover:bg-sky-600 shadow-sky-200 dark:shadow-none'
                                    }`}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        <span>Gönderiliyor...</span>
                                    </>
                                ) : (
                                    <>
                                        <UserPlus size={20} />
                                        <span>Arkadaş Ekle</span>
                                    </>
                                )}
                            </button>
                        )
                    )}
                </div>
            </div>
        </div>
    )
}
