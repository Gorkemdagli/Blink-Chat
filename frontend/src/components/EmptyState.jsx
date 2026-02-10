/**
 * Oda seçilmediğinde gösterilen boş durum component'i
 */
export default function EmptyState() {
    return (
        <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-900">
            <div className="text-center">
                <div className="text-6xl mb-4">💬</div>
                <p className="text-lg font-bold text-slate-800 dark:text-gray-200">
                    Bir oda seçin veya sohbete başlayın
                </p>
                <p className="text-sm mt-2 font-medium">
                    Odalar veya Arkadaşlar sekmesinden seçim yapın
                </p>
            </div>
        </div>
    )
}
