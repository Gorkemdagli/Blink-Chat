import io, { Socket } from 'socket.io-client'

// Singleton socket instance
let socket: Socket | null = null
let connectionCount = 0
let isInitializing = false
let currentToken: string | null = null

// Bağlantı durumu dinleyicileri — UI banner/toast için hafif pub/sub.
type ConnectionState = 'connected' | 'disconnected' | 'connecting'
const connectionListeners = new Set<(state: ConnectionState) => void>()

const emitConnectionState = (state: ConnectionState) => {
    connectionListeners.forEach(cb => {
        try { cb(state) } catch { /* dinleyici hatası diğerlerini engellemesin */ }
    })
}

/**
 * Bağlantı durumu değişimlerine abone ol. Çıkışta listener kaydını sil.
 * Reconnecting banner gibi UI bileşenleri tarafından kullanılır.
 */
export const onConnectionStateChange = (cb: (state: ConnectionState) => void): (() => void) => {
    connectionListeners.add(cb)
    // Mevcut durumu hemen bildir (yeni banner ilk render'da doğru state'i görsün)
    cb(socket?.connected ? 'connected' : (isInitializing ? 'connecting' : 'disconnected'))
    return () => connectionListeners.delete(cb)
}

/**
 * Mevcut access token'ı güncelle.
 * Socket bağlantısı zaten kuruluysa, yeni token ile yeniden bağlan.
 */
export const setSocketToken = (token: string | null) => {
    currentToken = token

    // Socket bağlantısı varsa auth objesini her zaman güncelle
    if (socket) {
        socket.auth = { token }

        // Eğer token değiştiyse ve aktif bağlantı varsa, yeniden bağlan
        if (token && socket.connected) {
            socket.disconnect().connect()
        } else if (token && !socket.connected) {
            // Bağlı değilse fakat token geldiyse bağlanmayı dene
            socket.connect()
        }
    }
}

export const getSocket = (token?: string | null): Socket => {
    if (token) {
        currentToken = token
    }

    if (isInitializing && socket) {
        return socket
    }

    if (!socket || !socket.connected) {
        if (!socket) {
            isInitializing = true
            socket = io(import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000', {
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 5,
                autoConnect: true,
                transports: ['websocket', 'polling'],
                forceNew: false,
                auth: {
                    token: currentToken
                }
            })

            socket.on('connect', () => {
                connectionCount++
                isInitializing = false
                emitConnectionState('connected')
            })

            socket.on('disconnect', (reason: string) => {
                isInitializing = false
                console.log(`🔌 Socket.IO disconnected: ${reason}`)
                emitConnectionState('disconnected')
            })

            socket.on('connect_error', (error: Error) => {
                isInitializing = false
                console.error('🔌 Socket.IO connection error:', error.message)
                emitConnectionState('connecting')
            })
        } else if (!socket.connected) {
            // Token güncelleyip yeniden bağlan
            if (currentToken) {
                socket.auth = { token: currentToken }
                socket.connect()
            }
        }
    } else if (socket && socket.connected && currentToken && (socket as any).auth?.token !== currentToken) {
        // Token changed while connected, reconnect
        socket.auth = { token: currentToken }
        socket.disconnect().connect()
    }

    return socket as Socket
}

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect()
        socket = null
        connectionCount = 0
        currentToken = null
    }
}

export const getConnectionCount = () => connectionCount
