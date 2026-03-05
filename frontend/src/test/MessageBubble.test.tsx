import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageBubble from '../components/MessageBubble';

vi.mock('lucide-react', () => ({
    FileText: () => <span data-testid="icon-filetext" />,
    Image: () => <span data-testid="icon-image" />,
    Download: () => <span data-testid="icon-download" />,
    Check: () => <span data-testid="icon-check" />
}));

describe('MessageBubble Component', () => {
    const defaultProps = {
        isMe: false,
        isGroupChat: false,
        isMobile: false,
        longPressMessageId: null,
        onUserClick: vi.fn(),
        handleTouchStart: vi.fn(),
        handleTouchEnd: vi.fn(),
        handleTouchMove: vi.fn(),
        handleDeleteMessage: vi.fn(),
        handleCancelDelete: vi.fn(),
        setPreviewImage: vi.fn(),
    };

    it('renders my text message correctly', () => {
        const msg = {
            id: '1',
            content: 'Hello there',
            sender: 'me', // Added for backward compatibility or internal logic if any
            user_id: 'me-id',
            created_at: new Date().toISOString(),
            status: 'sent'
        };

        const { container } = render(<MessageBubble {...defaultProps} msg={msg} isMe={true} />);

        expect(screen.getByText('Hello there')).toBeInTheDocument();
        // The top-level div has the alignment classes
        const topDiv = container.firstChild;
        expect(topDiv).toHaveClass('items-end');
        expect(topDiv).toHaveClass('self-end');
    });

    it('renders other user text message with sender name in group chat', () => {
        const msg = {
            id: '1',
            content: 'Hi friend',
            user_id: 'other-id',
            user: { username: 'OtherUser' },
            created_at: new Date().toISOString()
        };

        render(<MessageBubble {...defaultProps} msg={msg} isGroupChat={true} />);

        expect(screen.getByText('Hi friend')).toBeInTheDocument();
        expect(screen.getByText('OtherUser')).toBeInTheDocument();
    });

    it('renders expired file placeholder', () => {
        const msg = {
            id: '1',
            message_type: 'expired',
            content: 'Expired content',
            user_id: 'me-id',
            created_at: new Date().toISOString()
        };

        render(<MessageBubble {...defaultProps} msg={msg} isMe={true} />);

        expect(screen.getByText('Expired content')).toBeInTheDocument();
    });
});
