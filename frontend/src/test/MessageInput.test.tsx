import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MessageInput from '../components/MessageInput';

vi.mock('lucide-react', () => ({
    Paperclip: () => <span data-testid="icon-clip" />,
    Smile: () => <span data-testid="icon-smile" />,
    Send: () => <span data-testid="icon-send" />,
    File: () => <span data-testid="icon-file" />,
    Image: () => <span data-testid="icon-image" />,
    X: () => <span data-testid="icon-x" />,
}));
vi.mock('@emoji-mart/react', () => ({ default: () => <div data-testid="emoji-picker" /> }));
vi.mock('@emoji-mart/data', () => ({ default: {} }));

describe('MessageInput Component', () => {
    const defaultProps = {
        inputValue: '',
        handleInputChange: vi.fn(),
        handleKeyPress: vi.fn(),
        handleSend: vi.fn(),
        isUploading: false,
        selectedFile: null,
        setSelectedFile: vi.fn(),
        showAttachMenu: false,
        setShowAttachMenu: vi.fn(),
        showEmojiPicker: false,
        toggleEmojiPicker: vi.fn(),
        handleEmojiSelect: vi.fn(),
        fileInputRef: { current: null } as any,
        handleFileSelect: vi.fn(),
        emojiPickerRef: { current: null } as any,
        attachMenuRef: { current: null } as any,
        isMobile: false
    };

    it('renders input area correctly', () => {
        render(<MessageInput {...defaultProps} />);

        expect(screen.getByPlaceholderText('Mesaj yaz...')).toBeInTheDocument();
        expect(screen.getByTestId('icon-clip')).toBeInTheDocument();
        expect(screen.getByTestId('icon-smile')).toBeInTheDocument();
    });

    it('types text and sends empty correctly (button disabled)', () => {
        render(<MessageInput {...defaultProps} inputValue="  " />);

        const sendBtn = screen.getByLabelText('Mesajı Gönder') as HTMLButtonElement;
        expect(sendBtn).toBeDisabled();
    });

    it('enables send button with text', () => {
        render(<MessageInput {...defaultProps} inputValue="Hello world" />);

        const sendBtn = screen.getByLabelText('Mesajı Gönder') as HTMLButtonElement;
        expect(sendBtn).not.toBeDisabled();
    });

    it('triggers handleInputChange on typing', () => {
        render(<MessageInput {...defaultProps} />);

        const input = screen.getByPlaceholderText('Mesaj yaz...');
        fireEvent.change(input, { target: { value: 'New text' } });

        expect(defaultProps.handleInputChange).toHaveBeenCalled();
    });

    it('triggers handleSend on click', () => {
        render(<MessageInput {...defaultProps} inputValue="Ready" />);

        const sendBtn = screen.getByLabelText('Mesajı Gönder');
        fireEvent.click(sendBtn);

        expect(defaultProps.handleSend).toHaveBeenCalled();
    });
});
