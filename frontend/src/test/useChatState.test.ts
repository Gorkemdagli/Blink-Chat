import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useChatState from '../hooks/useChatState';

describe('useChatState', () => {
    it('should initialize with default state', () => {
        const { result } = renderHook(() => useChatState());

        expect(result.current.friends).toEqual([]);
        expect(result.current.rooms).toEqual([]);
        expect(result.current.currentRoom).toBeNull();
        expect(result.current.messages).toEqual([]);
        expect(result.current.activeTab).toBe('rooms');
    });

    it('should update state functions correctly', () => {
        const { result } = renderHook(() => useChatState());

        act(() => {
            result.current.setActiveTab('friends');
            result.current.setCurrentRoom({ id: 'room1', name: 'Test Room', type: 'private' } as any);
            result.current.setFriends([{ id: 'user1', username: 'friend' }] as any);
        });

        expect(result.current.activeTab).toBe('friends');
        expect(result.current.currentRoom?.id).toBe('room1');
        expect(result.current.friends).toHaveLength(1);
    });

    it('should add message locally', () => {
        const { result: state } = renderHook(() => useChatState());

        act(() => {
            state.current.setMessages([{ id: 'msg1', content: 'hello' } as any]);
        });

        expect(state.current.messages).toHaveLength(1);

        act(() => {
            state.current.setMessages((prev) => [...prev, { id: 'msg2', content: 'world' } as any]);
        });

        expect(state.current.messages).toHaveLength(2);
    });
});
