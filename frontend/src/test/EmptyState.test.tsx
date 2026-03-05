import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmptyState from '../components/EmptyState';

describe('EmptyState Component', () => {
    it('should render standard message and generic icon', () => {
        render(<EmptyState />);

        expect(screen.getByText('Bir oda seçin veya sohbete başlayın')).toBeInTheDocument();
        expect(screen.getByText('Odalar veya Arkadaşlar sekmesinden seçim yapın')).toBeInTheDocument();
    });
});
