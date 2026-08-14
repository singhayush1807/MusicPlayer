'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────
export type SyncAction =
  | { type: 'play'; trackIndex: number; currentTime: number }
  | { type: 'pause'; currentTime: number }
  | { type: 'seek'; currentTime: number }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'heartbeat'; trackIndex: number; currentTime: number; isPlaying: boolean }
  | { type: 'request_sync' };

export interface RoomMember {
  id: string;
  joinedAt: number;
}

export interface ListenTogetherState {
  isConnected: boolean;
  isInRoom: boolean;
  roomCode: string | null;
  memberCount: number;
  error: string | null;
}

// ─── Code Generator ──────────────────────────────────
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/1/O/0 for clarity
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ─── Hook ────────────────────────────────────────────
export function useListenTogether(
  // Callbacks that the player provides so the hook can control it
  onSyncAction: (action: SyncAction) => void,
  getLocalState: () => { trackIndex: number; currentTime: number; isPlaying: boolean }
) {
  const [state, setState] = useState<ListenTogetherState>({
    isConnected: false,
    isInRoom: false,
    roomCode: null,
    memberCount: 0,
    error: null,
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const myId = useRef<string>(Math.random().toString(36).substring(2, 10));
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

  // Clean up on unmount / tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      disconnect();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      disconnect();
    };
  }, []);

  // ── Create Room ──────────────────────────────────
  const createRoom = useCallback(() => {
    if (!supabase) {
      setState(s => ({ ...s, error: 'Supabase not configured. Add keys to .env' }));
      return;
    }

    const code = generateRoomCode();
    const channelName = `room-${code}`;

    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'sync' }, (payload) => {
        const action = payload.payload as SyncAction;
        if (action) onSyncAction(action);
      })
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const count = Object.keys(presenceState).reduce(
          (acc, key) => acc + (presenceState[key] as any[]).length, 0
        );
        setState(s => ({ ...s, memberCount: count }));
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        const presenceState = channel.presenceState();
        const count = Object.keys(presenceState).reduce(
          (acc, key) => acc + (presenceState[key] as any[]).length, 0
        );
        setState(s => ({ ...s, memberCount: count }));
        
        // If someone else joined, broadcast our state to them
        const isMe = newPresences.some(p => p.id === myId.current);
        if (!isMe) {
          const st = getLocalState();
          channel.send({
            type: 'broadcast',
            event: 'sync',
            payload: { type: 'heartbeat', ...st }
          });
        }
      })
      .on('presence', { event: 'leave' }, () => {
        const presenceState = channel.presenceState();
        const count = Object.keys(presenceState).reduce(
          (acc, key) => acc + (presenceState[key] as any[]).length, 0
        );
        setState(s => ({ ...s, memberCount: count }));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ id: myId.current, joinedAt: Date.now() });
          setState(s => ({
            ...s,
            isConnected: true,
            isInRoom: true,
            roomCode: code,
            error: null,
          }));
        }
      });

    channelRef.current = channel;
  }, [onSyncAction, getLocalState]);

  // ── Join Room ────────────────────────────────────
  const joinRoom = useCallback((code: string) => {
    if (!supabase) {
      setState(s => ({ ...s, error: 'Supabase not configured. Add keys to .env' }));
      return;
    }

    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length !== 6) {
      setState(s => ({ ...s, error: 'Enter a valid 6-character room code' }));
      return;
    }

    const channelName = `room-${cleanCode}`;

    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'sync' }, (payload) => {
        const action = payload.payload as SyncAction;
        if (action) {
          if (action.type === 'request_sync') {
            const st = getLocalState();
            channel.send({
              type: 'broadcast',
              event: 'sync',
              payload: { type: 'heartbeat', ...st }
            });
          } else {
            onSyncAction(action);
          }
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const count = Object.keys(presenceState).reduce(
          (acc, key) => acc + (presenceState[key] as any[]).length, 0
        );
        setState(s => ({ ...s, memberCount: count }));
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        const presenceState = channel.presenceState();
        const count = Object.keys(presenceState).reduce(
          (acc, key) => acc + (presenceState[key] as any[]).length, 0
        );
        setState(s => ({ ...s, memberCount: count }));
        
        // If someone else joined, broadcast our state to them
        const isMe = newPresences.some(p => p.id === myId.current);
        if (!isMe) {
          const st = getLocalState();
          channel.send({
            type: 'broadcast',
            event: 'sync',
            payload: { type: 'heartbeat', ...st }
          });
        }
      })
      .on('presence', { event: 'leave' }, () => {
        const presenceState = channel.presenceState();
        const count = Object.keys(presenceState).reduce(
          (acc, key) => acc + (presenceState[key] as any[]).length, 0
        );
        setState(s => ({ ...s, memberCount: count }));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ id: myId.current, joinedAt: Date.now() });
          setState(s => ({
            ...s,
            isConnected: true,
            isInRoom: true,
            roomCode: cleanCode,
            error: null,
          }));
          
          // Request initial state from others in the room
          channel.send({
            type: 'broadcast',
            event: 'sync',
            payload: { type: 'request_sync' }
          });
        }
      });

    channelRef.current = channel;
  }, [onSyncAction, getLocalState]);

  // ── Broadcast Action ─────────────────────────────
  const broadcastAction = useCallback((action: SyncAction) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'sync',
      payload: action,
    });
  }, []);

  // ── Disconnect ───────────────────────────────────
  const disconnect = useCallback(() => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
    }
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    setState({
      isConnected: false,
      isInRoom: false,
      roomCode: null,
      memberCount: 0,
      error: null,
    });
  }, []);

  return {
    ...state,
    createRoom,
    joinRoom,
    broadcastAction,
    disconnect,
  };
}
