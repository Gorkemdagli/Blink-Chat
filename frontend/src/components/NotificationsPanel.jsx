/**
 * Bildirimler paneli component'i (Oda davetleri ve arkadaşlık istekleri)
 */
export default function NotificationsPanel({
    pendingInvitations,
    friendRequests,
    onAcceptInvitation,
    onRejectInvitation,
    onAcceptFriendRequest,
    onRejectFriendRequest,
    onClose
}) {
    const hasNotifications = pendingInvitations.length > 0 || friendRequests.length > 0

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4 sticky top-0 bg-white dark:bg-slate-800 pb-2 border-b dark:border-slate-700">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">🔔 Bildirimlerim</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
                    >
                        ✕
                    </button>
                </div>

                {!hasNotifications ? (
                    <div className="text-center py-8">
                        <p className="text-6xl mb-4">📭</p>
                        <p className="text-gray-500 dark:text-gray-400">Bildiriminiz yok</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Arkadaşlık İstekleri */}
                        {friendRequests.length > 0 && (
                            <div>
                                <h4 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    Arkadaşlık İstekleri
                                    <span className="bg-sky-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                                        {friendRequests.length}
                                    </span>
                                </h4>
                                <div className="space-y-3">
                                    {friendRequests.map(req => (
                                        <div
                                            key={`req-${req.id}`}
                                            className="bg-white dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all"
                                        >
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-sky-400 to-indigo-500 p-0.5">
                                                    <div className="w-full h-full bg-white dark:bg-slate-900 rounded-full flex items-center justify-center overflow-hidden">
                                                        <img
                                                            src={req.sender_avatar || `https://ui-avatars.com/api/?name=${req.sender_username || req.sender_email}`}
                                                            className="w-full h-full object-cover"
                                                            alt="Avatar"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-slate-800 dark:text-white truncate">
                                                        {req.sender_username || req.sender_email}
                                                    </p>
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">
                                                        Yeni arkadaş isteği
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => onAcceptFriendRequest(req.id)}
                                                    className="flex-1 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-sky-100 dark:shadow-none"
                                                >
                                                    Kabul Et
                                                </button>
                                                <button
                                                    onClick={() => onRejectFriendRequest(req.id)}
                                                    className="flex-1 py-2 bg-gray-100 dark:bg-slate-600 text-slate-700 dark:text-gray-300 rounded-xl font-bold text-xs hover:bg-gray-200 dark:hover:bg-slate-500 transition-all"
                                                >
                                                    Reddet
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Oda Davetleri */}
                        {pendingInvitations.length > 0 && (
                            <div>
                                <h4 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    Oda Davetleri
                                    <span className="bg-purple-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                                        {pendingInvitations.length}
                                    </span>
                                </h4>
                                <div className="space-y-3">
                                    {pendingInvitations.map(invite => (
                                        <div
                                            key={`room-${invite.id}`}
                                            className="bg-white dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all"
                                        >
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-400 to-pink-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-purple-100 dark:shadow-none">
                                                    {(invite.room_name || '?')[0].toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-slate-800 dark:text-white truncate">
                                                        {invite.room_name}
                                                    </p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        <span className="font-bold text-purple-500">
                                                            {invite.inviter_username || invite.inviter_email}
                                                        </span> davet etti
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => onAcceptInvitation(invite.id)}
                                                    className="flex-1 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-purple-100 dark:shadow-none"
                                                >
                                                    Katıl
                                                </button>
                                                <button
                                                    onClick={() => onRejectInvitation(invite.id)}
                                                    className="flex-1 py-2 bg-gray-100 dark:bg-slate-600 text-slate-700 dark:text-gray-300 rounded-xl font-bold text-xs hover:bg-gray-200 dark:hover:bg-slate-500 transition-all"
                                                >
                                                    Reddet
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
