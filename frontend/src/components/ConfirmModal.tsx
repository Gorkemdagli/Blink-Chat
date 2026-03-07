import { X, AlertTriangle } from 'lucide-react'

interface ConfirmModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    description: string
    confirmText?: string
    cancelText?: string
    variant?: 'danger' | 'warning' | 'info'
}

export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = 'Onayla',
    cancelText = 'İptal',
    variant = 'danger'
}: ConfirmModalProps) {
    if (!isOpen) return null

    const variantStyles = {
        danger: 'bg-red-500 hover:bg-red-600 shadow-red-200 dark:shadow-none',
        warning: 'bg-amber-500 hover:bg-amber-600 shadow-amber-200 dark:shadow-none',
        info: 'bg-sky-500 hover:bg-sky-600 shadow-sky-200 dark:shadow-none'
    }

    const iconStyles = {
        danger: 'text-red-500 bg-red-50 dark:bg-red-900/20',
        warning: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20',
        info: 'text-sky-500 bg-sky-50 dark:bg-sky-900/20'
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className={`p-4 rounded-full ${iconStyles[variant]}`}>
                        <AlertTriangle size={32} />
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                            {title}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                            {description}
                        </p>
                    </div>

                    <div className="flex flex-col w-full gap-2 pt-2">
                        <button
                            onClick={() => {
                                onConfirm()
                                onClose()
                            }}
                            className={`w-full py-3 text-white font-bold rounded-xl transition-all shadow-lg active:scale-[0.98] ${variantStyles[variant]}`}
                        >
                            {confirmText}
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full py-3 text-gray-500 dark:text-gray-400 font-semibold hover:bg-gray-100 dark:hover:bg-slate-700/50 rounded-xl transition-all"
                        >
                            {cancelText}
                        </button>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>
        </div>
    )
}
