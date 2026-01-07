import { useState } from 'react'
import { X, CheckCircle2, AlertCircle } from 'lucide-react'

export default function AddFriendModal({ 
  onClose, 
  onAddFriend,
  isLoading = false
}) {
  const [friendCode, setFriendCode] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSend = async () => {
    const code = parseInt(friendCode)
    if (!code || friendCode.length !== 7) {
      setError('Geçerli bir 7 haneli kod girin')
      return
    }

    setError('')
    const result = await onAddFriend(code)
    
    if (result.success) {
      setSuccess(true)
      setTimeout(() => {
        onClose()
        setFriendCode('')
        setSuccess(false)
      }, 1500)
    } else {
      setError(result.error || 'Hata oluştu')
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
      <div className="relative w-full max-w-[400px] bg-white rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="text-xl font-bold text-slate-900">Arkadaş Ekle</h2>
          <button 
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-slate-600 hover:bg-gray-100 rounded-full transition-all"
          >
            <X size={24} />
          </button>
        </div>

        <div className="px-6 pb-8 space-y-4 text-center">
          {/* Success Alert */}
          {success && (
            <div className="flex items-center gap-3 px-4 py-3 bg-[#E6F4F1] border border-[#CDE9E3] rounded-xl text-[13px] text-[#2C6A5F] font-medium">
              <CheckCircle2 size={18} className="text-[#3BAE9B] shrink-0" />
              <span>Arkadaşlık isteği başarıyla gönderildi!</span>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="flex items-center gap-3 px-4 py-3 bg-[#FEECEC] border border-[#FAD2D2] rounded-xl text-[13px] text-[#8B2C2C] font-medium">
              <AlertCircle size={18} className="text-[#E5484D] shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Input Field */}
          <div className="pt-2">
            <input 
              type="text" 
              placeholder="Arkadaşlık kodu girin (7 haneli)" 
              value={friendCode}
              onChange={(e) => {
                setFriendCode(e.target.value.replace(/\D/g, '').slice(0, 7))
                setError('')
              }}
              className="w-full px-5 py-3.5 rounded-2xl border-[3px] border-[#D0D4F1] text-gray-600 placeholder:text-gray-400 focus:outline-none focus:border-[#7C87EA] transition-all text-sm font-medium text-center text-2xl font-mono tracking-wider"
              maxLength="7"
            />
          </div>

          {/* Send Button */}
          <button 
            onClick={handleSend}
            disabled={isLoading || friendCode.length !== 7}
            className={`w-full py-4 text-white font-bold rounded-[20px] transition-all active:scale-[0.98] shadow-lg ${
              isLoading || friendCode.length !== 7
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-[#6366F1] hover:bg-[#5558E3] shadow-indigo-100'
            }`}
          >
            {isLoading ? 'Gönderiliyor...' : 'Gönder'}
          </button>

          {/* Cancel Link */}
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors"
          >
            İptal
          </button>
        </div>
      </div>
    </div>
  )
}

