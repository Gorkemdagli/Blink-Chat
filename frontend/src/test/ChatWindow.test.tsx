import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ChatWindow from '../components/ChatWindow';

// Spy refs (reset in each beforeEach)
let pushStateCallCount = 0;
let replaceStateCallCount = 0;

// Mock dependencies to avoid errors during rendering
vi.mock('lucide-react', () => ({
    Search: () => <span data-testid="icon-search">Search</span>,
    MoreHorizontal: () => <span data-testid="icon-more">More</span>,
    Paperclip: () => <span data-testid="icon-clip">Clip</span>,
    Smile: () => <span data-testid="icon-smile">Smile</span>,
    Send: () => <span data-testid="icon-send">Send</span>,
    ArrowLeft: (props: any) => <button data-testid="icon-back" onClick={props.onClick}>Back</button>,
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
    default: ({ onBack }: any) => (
        <div data-testid="chat-header">
            <button data-testid="header-back" onClick={onBack}>Geri</button>
            Header
        </div>
    )
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

// --- History Sentinel Tests ---

describe('ChatWindow History Sentinel', () => {
    beforeEach(() => {
        pushStateCallCount = 0;
        replaceStateCallCount = 0;
        vi.spyOn(window.history, 'pushState').mockImplementation(() => { pushStateCallCount++; });
        vi.spyOn(window.history, 'replaceState').mockImplementation(() => { replaceStateCallCount++; });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('pushState called with #chat on mount', async () => {
        const onBack = vi.fn();
        render(
            <ChatWindow
                selectedRoom={{ id: 'room1', name: 'Test', type: 'private' } as any}
                messages={[]}
                session={{ user: { id: 'user1' } } as any}
                onSendMessage={vi.fn()}
                onBack={onBack}
                currentUser={{ id: 'user1', username: 'me' } as any}
                isLoadingMessages={false}
                isLoadingMoreMessages={false}
                hasMoreMessages={false}
                userPresence={new Map()}
            />
        );

        await act(async () => { await new Promise(r => setTimeout(r, 50)); });

        expect(pushStateCallCount).toBeGreaterThan(0);
        const calls = (window.history.pushState as any).mock.calls;
        const hasChatHash = calls.some((call: any[]) => call[2]?.includes('#chat'));
        expect(hasChatHash).toBe(true);
    });

    it('room change calls replaceState (not pushState) — no stacking', async () => {
        const onBack = vi.fn();
        const { rerender } = render(
            <ChatWindow
                selectedRoom={{ id: 'room1', name: 'Test', type: 'private' } as any}
                messages={[]}
                session={{ user: { id: 'user1' } } as any}
                onSendMessage={vi.fn()}
                onBack={onBack}
                currentUser={{ id: 'user1', username: 'me' } as any}
                isLoadingMessages={false}
                isLoadingMoreMessages={false}
                hasMoreMessages={false}
                userPresence={new Map()}
            />
        );

        await act(async () => { await new Promise(r => setTimeout(r, 50)); });

        const pushCountBefore = pushStateCallCount;
        const replaceCountBefore = replaceStateCallCount;

        // Simulate room change
        rerender(
            <ChatWindow
                selectedRoom={{ id: 'room2', name: 'Test2', type: 'private' } as any}
                messages={[]}
                session={{ user: { id: 'user1' } } as any}
                onSendMessage={vi.fn()}
                onBack={onBack}
                currentUser={{ id: 'user1', username: 'me' } as any}
                isLoadingMessages={false}
                isLoadingMoreMessages={false}
                hasMoreMessages={false}
                userPresence={new Map()}
            />
        );

        await act(async () => { await new Promise(r => setTimeout(r, 50)); });

        // Room change should replace, not push — pushState count unchanged
        expect(pushStateCallCount).toBe(pushCountBefore);
        expect(replaceStateCallCount).toBeGreaterThan(replaceCountBefore);
    });

    it('StrictMode double-mount: back closes chat on first press', async () => {
        const onBack = vi.fn();

        const { unmount, rerender } = render(
            <ChatWindow
                selectedRoom={{ id: 'room1', name: 'Test', type: 'private' } as any}
                messages={[]}
                session={{ user: { id: 'user1' } } as any}
                onSendMessage={vi.fn()}
                onBack={onBack}
                currentUser={{ id: 'user1', username: 'me' } as any}
                isLoadingMessages={false}
                isLoadingMoreMessages={false}
                hasMoreMessages={false}
                userPresence={new Map()}
            />
        );

        await act(async () => { await new Promise(r => setTimeout(r, 50)); });

        // Simulate StrictMode unmount/remount
        unmount();

        const { unmount: unmount2 } = render(
            <ChatWindow
                selectedRoom={{ id: 'room1', name: 'Test', type: 'private' } as any}
                messages={[]}
                session={{ user: { id: 'user1' } } as any}
                onSendMessage={vi.fn()}
                onBack={onBack}
                currentUser={{ id: 'user1', username: 'me' } as any}
                isLoadingMessages={false}
                isLoadingMoreMessages={false}
                hasMoreMessages={false}
                userPresence={new Map()}
            />
        );

        await act(async () => { await new Promise(r => setTimeout(r, 50)); });

        // Back button triggers replaceState and onBack — chat closes cleanly
        fireEvent.click(screen.getByTestId('header-back'));
        await act(async () => { await new Promise(r => setTimeout(r, 50)); });

        expect(replaceStateCallCount).toBeGreaterThan(0);
        expect(onBack).toHaveBeenCalled();
        unmount2();
    });

    it('replaceState called when header back button clicked', async () => {
        const onBack = vi.fn();
        render(
            <ChatWindow
                selectedRoom={{ id: 'room1', name: 'Test', type: 'private' } as any}
                messages={[]}
                session={{ user: { id: 'user1' } } as any}
                onSendMessage={vi.fn()}
                onBack={onBack}
                currentUser={{ id: 'user1', username: 'me' } as any}
                isLoadingMessages={false}
                isLoadingMoreMessages={false}
                hasMoreMessages={false}
                userPresence={new Map()}
            />
        );

        await act(async () => { await new Promise(r => setTimeout(r, 50)); });
        pushStateCallCount = 0;

        fireEvent.click(screen.getByTestId('header-back'));

        await act(async () => { await new Promise(r => setTimeout(r, 50)); });

        expect(replaceStateCallCount).toBeGreaterThan(0);
        expect(onBack).toHaveBeenCalled();
    });

    it('cleanup does NOT call history.back()', async () => {
        const historyBackSpy = vi.spyOn(window.history, 'back');

        const onBack = vi.fn();
        const { unmount } = render(
            <ChatWindow
                selectedRoom={{ id: 'room1', name: 'Test', type: 'private' } as any}
                messages={[]}
                session={{ user: { id: 'user1' } } as any}
                onSendMessage={vi.fn()}
                onBack={onBack}
                currentUser={{ id: 'user1', username: 'me' } as any}
                isLoadingMessages={false}
                isLoadingMoreMessages={false}
                hasMoreMessages={false}
                userPresence={new Map()}
            />
        );

        await act(async () => { await new Promise(r => setTimeout(r, 50)); });
        unmount();

        expect(historyBackSpy).not.toHaveBeenCalled();
    });
});

// --- Original ChatWindow Component Tests ---

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
            user_id: 'user1',
            sender: 'me',
            created_at: new Date().toISOString()
        },
        {
            id: '2',
            content: 'Selam!',
            user_id: 'user2',
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

        expect(screen.getByText('Merhaba dünya')).toBeInTheDocument();
        expect(screen.getByText('Selam!')).toBeInTheDocument();
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
