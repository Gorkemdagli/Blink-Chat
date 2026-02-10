/**
 * Toast bildirim component'i
 */
export default function Toast({ toast, onClose }) {
    if (!toast) return null

    return (
        <div className="fixed bottom-6 right-6 z-[100] animate-slide-up">
            <div className={`rounded-lg shadow-2xl px-6 py-4 flex items-center gap-3 min-w-[300px] max-w-md border-2 ${toast.type === 'success'
                    ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-500 text-green-800'
                    : toast.type === 'error'
                        ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-500 text-red-800'
                        : 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-500 text-blue-800'
                }`}>
                <div className="text-2xl">
                    {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
                </div>
                <div className="flex-1">
                    <p className="font-medium text-sm">{toast.message}</p>
                </div>
                <button
                    onClick={onClose}
                    className="text-gray-500 hover:text-gray-700 text-xl leading-none"
                >
                    ×
                </button>
            </div>
        </div>
    )
}
