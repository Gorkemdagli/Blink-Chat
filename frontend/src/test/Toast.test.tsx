import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Toast from '../components/Toast';

describe('Toast Component', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    it('renders message correctly and has success styling by default', () => {
        const toast = { message: "Login successful", type: 'success' as const };
        render(<Toast toast={toast} onClose={vi.fn()} />);

        expect(screen.getByText('Login successful')).toBeInTheDocument();
        // The component uses bg-gradient-to-r and border-green-500 for success
        const container = screen.getByText('Login successful').closest('.border-2');
        expect(container?.className).toContain('border-green-500');
    });

    it('renders error variants correctly', () => {
        const toast = { message: "Login failed", type: 'error' as const };
        render(<Toast toast={toast} onClose={vi.fn()} />);

        expect(screen.getByText('Login failed')).toBeInTheDocument();
        const container = screen.getByText('Login failed').closest('.border-2');
        expect(container?.className).toContain('border-red-500');
    });

    it('calls onClose when close button is clicked', () => {
        const onClose = vi.fn();
        const toast = { message: "Click to close", type: 'info' as const };
        render(<Toast toast={toast} onClose={onClose} />);

        const closeButton = screen.getByText('×');
        closeButton.click();

        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
