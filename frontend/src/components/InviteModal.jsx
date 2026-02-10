/**
 * Kullanıcı davet modalı component'i
 */
export default function InviteModal({ currentRoom, users, onSendInvitation, onClose }) {
    if (!currentRoom) return null

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">Üye Davet Et</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        ✕
                    </button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    <strong>{currentRoom.name}</strong> odasına davet göndermek istediğiniz kullanıcıyı seçin:
                </p>
                <div className="max-h-96 overflow-y-auto space-y-2">
                    {users.length === 0 ? (
                        <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                            Davet edilecek kullanıcı yok
                        </p>
                    ) : (
                        users
                            .filter(user => !currentRoom.members?.includes(user.id))
                            .map(user => (
                                <div
                                    key={user.id}
                                    className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                                            {(user.username || user.email || 'U')[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-gray-900 dark:text-white">
                                                    {user.username || user.email}
                                                </p>
                                                {user.user_code && (
                                                    <span className="text-xs text-gray-400 font-mono">
                                                        #{user.user_code}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {user.email}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onSendInvitation(user.id)}
                                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                                    >
                                        Davet Gönder
                                    </button>
                                </div>
                            ))
                    )}
                </div>
            </div>
        </div>
    )
}
