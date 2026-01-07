// Types for the chat application

export const Message = {
  id: String,
  text: String,
  sender: 'me' | 'other',
  timestamp: String,
  avatar: String
}

export const Room = {
  id: String,
  name: String,
  type: 'Grup' | 'Direkt Mesaj',
  status: String,
  role: String,
  avatar: String
}

export const Friend = {
  id: String,
  name: String,
  userId: String,
  avatar: String,
  online: Boolean
}

export const TabType = 'Rooms' | 'Friends'

