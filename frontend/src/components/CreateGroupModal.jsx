import { useState } from 'react'
import { X, CheckCircle2, Search } from 'lucide-react'

export default function CreateGroupModal({
  friends = [],
  onClose,
  onCreateGroup,
  isLoading = false
}) {
  const [groupName, setGroupName] = useState('')
  const [selectedFriends, setSelectedFriends] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const filteredFriends = friends.filter(friend => {
    const name = friend.friend_username || friend.friend_email || ''
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const toggleFriend = (friendId) => {
    setSelectedFriends(prev =>
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    )
  }

  const handleCreate = async () => {
    if (!groupName.trim()) {
      setError('Lütfen bir grup adı girin')
      return
    }

    setError('')
    const result = await onCreateGroup(groupName.trim(), selectedFriends)

    if (result.success) {
      setSuccess(true)
      setTimeout(() => {
        onClose()
        setGroupName('')
        setSelectedFriends([])
        setSuccess(false)
      }, 1500)
    } else {
      setError(result.error || 'Grup oluşturulamadı')
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
      <div className="relative w-full max-w-[440px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-2">
          <h2 className="text-lg font-bold text-slate-900">Yeni Grup Oluşturma</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-slate-600 hover:bg-gray-100 rounded-full transition-all"
          >
            <X size={22} />
          </button>
        </div>

        {/* Success Alert */}
        {success && (
          <div className="mx-5 mb-4">
            <div className="flex items-center gap-3 px-4 py-3 bg-[#E6F4F1] border border-[#CDE9E3] rounded-xl text-[13px] text-[#2C6A5F] font-medium">
              <CheckCircle2 size={18} className="text-[#3BAE9B]" />
              <span>Grup başarıyla oluşturuldu!</span>
            </div>
          </div>
        )}

        {/* Form Body */}
        <div className="px-5 pb-2 flex-1 overflow-y-auto">
          {/* Group Name Field */}
          <div className="mb-5">
            <label className="block text-sm font-bold text-slate-800 mb-1.5">Grup Adı</label>
            <input
              type="text"
              placeholder="Grup adını girin"
              value={groupName}
              onChange={(e) => {
                setGroupName(e.target.value)
                setError('')
              }}
              className={`w-full px-4 py-2.5 rounded-xl border transition-all ${error && !groupName.trim()
                ? 'bg-red-50 border-red-200 focus:ring-2 focus:ring-red-100'
                : 'bg-gray-50 border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-100'
                }`}
            />
            {error && !groupName.trim() && (
              <p className="mt-1.5 text-xs text-red-500/80">
                {error}
              </p>
            )}
          </div>

          {/* Member Search */}
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1.5">Üye Ekle</label>
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Arkadaş ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-100 transition-all text-sm"
              />
            </div>

            {/* Member List */}
            <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
              {filteredFriends.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-sm">
                  {searchQuery ? 'Arkadaş bulunamadı' : 'Henüz arkadaşın yok'}
                </div>
              ) : (
                filteredFriends.map(friend => {
                  const friendId = friend.friend_id || friend.id
                  const isSelected = selectedFriends.includes(friendId)
                  const friendName = friend.friend_username || friend.friend_email || 'Kullanıcı'
                  return (
                    <div
                      key={friendId}
                      onClick={() => toggleFriend(friendId)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${isSelected ? 'bg-sky-50 border border-sky-200' : 'hover:bg-gray-50'
                        }`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected
                        ? 'bg-sky-600 border-sky-600'
                        : 'border-gray-300'
                        }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <img
                        src={friend.friend_avatar || `https://ui-avatars.com/api/?name=${friendName}`}
                        className="w-10 h-10 rounded-full object-cover bg-gray-200"
                        alt={friendName}
                      />
                      <span className="text-sm font-semibold text-slate-700">
                        {friendName}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="p-5 flex items-center justify-end gap-3 bg-white">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-gray-100 hover:bg-gray-200 transition-all active:scale-95"
          >
            İptal
          </button>
          <button
            onClick={handleCreate}
            disabled={isLoading || !groupName.trim()}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 shadow-sm ${isLoading || !groupName.trim()
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-[#92B1D9] hover:bg-[#7FA3D1]'
              }`}
          >
            {isLoading ? 'Oluşturuluyor...' : 'Oluştur'}
          </button>
        </div>
      </div>
    </div>
  )
}

