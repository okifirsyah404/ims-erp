import { create } from 'zustand';
import type { TConnectionStatus } from './realtime-client';

/**
 * Ephemeral realtime state only (D9): server data lives in TanStack Query.
 *
 * @remarks
 * A store, not React context, because the socket is mounted once by the
 * authenticated shell while any component may want to read its status without
 * re-rendering the tree that owns the connection.
 */
type TRealtimeState = {
	status: TConnectionStatus;
	setStatus: (status: TConnectionStatus) => void;
};

export const useRealtimeStore = create<TRealtimeState>((set) => ({
	status: 'closed',
	setStatus: (status) => set({ status }),
}));
