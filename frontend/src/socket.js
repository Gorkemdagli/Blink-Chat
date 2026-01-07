import io from 'socket.io-client'

// Singleton socket instance
let socket = null
let connectionCount = 0
let isInitializing = false

export const getSocket = () => {
    // Eğer zaten initialize ediliyor ise bekle
    if (isInitializing) {
        console.log('⏳ Socket already initializing, returning existing...')
        return socket
    }
    
    if (!socket || !socket.connected) {
        // Eğer socket yoksa veya bağlı değilse yeni oluştur
        if (!socket) {
            isInitializing = true
            socket = io('http://localhost:3000', {
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 5,
                autoConnect: true,
                transports: ['websocket', 'polling'], // WebSocket öncelikli
                forceNew: false // Mevcut bağlantıyı kullan
            })
            
            socket.on('connect', () => {
                connectionCount++
                isInitializing = false
            })
            
            socket.on('disconnect', (reason) => {
                isInitializing = false
                console.log(`🔌 Socket.IO disconnected: ${reason}`)
            })
            
            socket.on('connect_error', (error) => {
                isInitializing = false
                console.error('🔌 Socket.IO connection error:', error.message)
            })
        } else if (!socket.connected) {
            // Socket var ama bağlı değil, yeniden bağlan
            console.log('🔄 Reconnecting existing socket...')
            socket.connect()
        }
    }
    return socket
}

export const disconnectSocket = () => {
    if (socket) {
        console.log('🔌 Socket.IO disconnecting manually')
        socket.disconnect()
        socket = null
        connectionCount = 0
    }
}

export const getConnectionCount = () => connectionCount

