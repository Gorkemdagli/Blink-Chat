import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatWindow from '../components/ChatWindow';

// Mock dependencies to avoid errors during rendering
vi.mock('lucide-react', () => ({
    Search: () => <span data-testid="icon-search">Search</span>,
    MoreHorizontal: () => <span data-testid="icon-more">More</span>,
    Paperclip: () => <span data-testid="icon-clip">Clip</span>,
    Smile: () => <span data-testid="icon-smile">Smile</span>,
    Send: () => <span data-testid="icon-send">Send</span>,
    ArrowLeft: () => <span data-testid="icon-back">Back</span>,
    X: () => <span data-testid="icon-x">X</span>,
    Download: () => <span data-testid="icon-download">Download</span>,
    FileText: () => <span data-testid="icon-filetext">FileText</span>,
    Image: () => <span data-testid="icon-image">Image</span>,
    File: () => <span data-testid="icon-file">File</span>,
    Loader: () => <span data-testid="icon-loader">Loader</span>,
    Check: () => <span data-testid="icon-check">Check</span>,
}));

vi.mock('@emoji-mart/react', () => ({
    default: () => <div data-testid="emoji-picker">EmojiPicker</div>
}));

vi.mock('../socket', () => ({
    getSocket: vi.fn(() => ({
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        connected: true
    }))
}));

vi.mock('../components/ChatHeader', () => ({
    default: () => <div data-testid="chat-header">ChatHeader</div>
}));
vi.mock('../components/MessageList', () => ({
    default: (props: any) => (
        <div data-testid="message-list">
            {props.messages.length === 0 ? 'Henüz mesaj yok' : props.messages.map((m: any) => (
                <div key={m.id}>
                    {m.user?.username && <span>{m.user.username}</span>}
                    <div>{m.content}</div>
                </div>
            ))}
        </div>
    )
}));
vi.mock('../components/MessageInput', () => ({
    default: (props: any) => (
        <div data-testid="message-input">
            <input placeholder="Mesaj yaz..." value={props.inputValue} onChange={props.handleInputChange} />
        </div>
    )
}));
vi.mock('../components/ProfileModal', () => ({
    default: () => <div data-testid="profile-modal">ProfileModal</div>
}));
vi.mock('../components/GroupInfoModal', () => ({
    default: () => <div data-testid="group-info-modal">GroupInfoModal</div>
}));

describe('ChatWindow Bileşeni', () => {
    const mockSession: any = { user: { id: 'user1' } };
    const mockRoom: any = {
        id: 'room1',
        name: 'Test Room',
        type: 'private',
        isOwner: true
    };

    const mockMessages: any[] = [
        {
            id: '1',
            content: 'Merhaba dünya',
            user_id: 'user1', // Me
            sender: 'me',
            created_at: new Date().toISOString()
        },
        {
            id: '2',
            content: 'Selam!',
            user_id: 'user2', // Other
            user: { username: 'OtherUser' },
            sender: 'other',
            created_at: new Date().toISOString()
        }
    ];

    it('mesajları ve gönderen isimlerini doğru render etmeli', () => {
        render(
            <ChatWindow
                selectedRoom={mockRoom}
                messages={mockMessages}
                session={mockSession}
                onSendMessage={vi.fn()}
                onBack={vi.fn()}
                currentUser={{ id: 'user1', username: 'me', email: 'me@example.com' } as any}
                isLoadingMessages={false}
                isLoadingMoreMessages={false}
                hasMoreMessages={false}
                userPresence={new Map()}
            />
        );

        // Mesajların ekranda olduğunu kontrol et
        const myMessage = screen.getByText('Merhaba dünya');
        const otherMessage = screen.getByText('Selam!');

        expect(myMessage).toBeInTheDocument();
        expect(otherMessage).toBeInTheDocument();

        // Diğer kullanıcının isminin göründüğünü kontrol et
        // (Grup sohbetlerinde veya karşı taraf mesajlarında isim görünür)
        expect(screen.getByText('OtherUser')).toBeInTheDocument();
    });

    it('boş mesaj durumunu doğru göstermeli', () => {
        render(
            <ChatWindow
                selectedRoom={mockRoom}
                messages={[]}
                session={mockSession}
                onSendMessage={vi.fn()}
                onBack={vi.fn()}
                currentUser={{ id: 'user1', username: 'me', email: 'me@example.com' } as any}
                isLoadingMessages={false}
                isLoadingMoreMessages={false}
                hasMoreMessages={false}
                userPresence={new Map()}
            />
        );

        expect(screen.getByText('Henüz mesaj yok')).toBeInTheDocument();
    });

    it('input alanına yazı yazılabilmeli', () => {
        render(
            <ChatWindow
                selectedRoom={mockRoom}
                messages={mockMessages}
                session={mockSession}
                onSendMessage={vi.fn()}
                onBack={vi.fn()}
                currentUser={{ id: 'user1', username: 'me', email: 'me@example.com' } as any}
                isLoadingMessages={false}
                isLoadingMoreMessages={false}
                hasMoreMessages={false}
                userPresence={new Map()}
            />
        );

        const input: any = screen.getByPlaceholderText('Mesaj yaz...');
        fireEvent.change(input, { target: { value: 'Yeni mesaj' } });

        expect(input.value).toBe('Yeni mesaj');
    });
});
