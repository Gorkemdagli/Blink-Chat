import io, { Socket } from 'socket.io-client'

// Singleton socket instance
let socket: Socket | null = null
let connectionCount = 0
let isInitializing = false
let currentToken: string | null = null

/**
 * Mevcut access token'ı güncelle.
 * Socket bağlantısı zaten kuruluysa, yeni token ile yeniden bağlan.
 */
export const setSocketToken = (token: string | null) => {
    currentToken = token

    // Eğer token değiştiyse ve aktif bağlantı varsa, yeniden bağlan
    if (socket && token && socket.connected) {
        socket.auth = { token }
        socket.disconnect().connect()
    }
}

export const getSocket = (): Socket => {
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
            })

            socket.on('disconnect', (reason: string) => {
                isInitializing = false
                console.log(`🔌 Socket.IO disconnected: ${reason}`)
            })

            socket.on('connect_error', (error: Error) => {
                isInitializing = false
                console.error('🔌 Socket.IO connection error:', error.message)
            })
        } else if (!socket.connected) {
            // Token güncelleyip yeniden bağlan
            if (currentToken) {
                socket.auth = { token: currentToken }
            }
            socket.connect()
        }
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
