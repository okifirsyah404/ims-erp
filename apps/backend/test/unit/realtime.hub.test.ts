import { describe, expect, test } from 'bun:test';
import { realtimeMessage } from '../../src/providers/realtime/realtime.message';
import {
	InProcessRealtimeHub,
	type TRealtimeSocket,
} from '../../src/providers/realtime/realtime.hub';

/** A socket that records what the hub wrote to it. */
function recordingSocket(): TRealtimeSocket & { sent: string[] } {
	const sent: string[] = [];
	return {
		sent,
		send(payload: string) {
			sent.push(payload);
		},
	};
}

describe('realtimeMessage', () => {
	test('stamps the four envelope fields and defaults status to success', () => {
		const before = Date.now();
		const frame = realtimeMessage('notification.created', { id: 'n-1' });
		const after = Date.now();

		expect(Object.keys(frame).sort()).toEqual([
			'data',
			'sentAt',
			'status',
			'type',
		]);
		expect(frame.type).toBe('notification.created');
		expect(frame.status).toBe('success');
		expect(frame.data).toEqual({ id: 'n-1' });
		expect(frame.sentAt).toBeGreaterThanOrEqual(before);
		expect(frame.sentAt).toBeLessThanOrEqual(after);
	});

	test('keeps an explicit error status', () => {
		expect(realtimeMessage('x.y', { reason: 'boom' }, 'error').status).toBe(
			'error',
		);
	});
});

describe('InProcessRealtimeHub', () => {
	test('publishing to a fake socket yields the exact envelope', () => {
		const hub = new InProcessRealtimeHub();
		const socket = recordingSocket();
		hub.register('ws-1', 'user-1', socket);

		const delivered = hub.publish(
			'user-1',
			realtimeMessage('notification.created', { id: 'n-1' }),
		);

		expect(delivered).toBe(1);
		expect(socket.sent).toHaveLength(1);
		const frame = JSON.parse(socket.sent[0] as string);
		expect(Object.keys(frame).sort()).toEqual([
			'data',
			'sentAt',
			'status',
			'type',
		]);
		expect(frame).toMatchObject({
			type: 'notification.created',
			status: 'success',
			data: { id: 'n-1' },
		});
		expect(typeof frame.sentAt).toBe('number');
	});

	test('delivers to every tab of the same user', () => {
		const hub = new InProcessRealtimeHub();
		const tabA = recordingSocket();
		const tabB = recordingSocket();
		hub.register('ws-a', 'user-1', tabA);
		hub.register('ws-b', 'user-1', tabB);

		expect(hub.connectionCount('user-1')).toBe(2);
		expect(hub.publish('user-1', realtimeMessage('t', {}))).toBe(2);
		expect(tabA.sent).toHaveLength(1);
		expect(tabB.sent).toHaveLength(1);
	});

	test('a user with no socket is offline, not an error', () => {
		const hub = new InProcessRealtimeHub();

		expect(hub.publish('nobody', realtimeMessage('t', {}))).toBe(0);
		expect(hub.connectionCount('nobody')).toBe(0);
		expect(hub.connectionCount()).toBe(0);
	});

	test('never delivers to another user', () => {
		const hub = new InProcessRealtimeHub();
		const mine = recordingSocket();
		const theirs = recordingSocket();
		hub.register('ws-mine', 'user-1', mine);
		hub.register('ws-theirs', 'user-2', theirs);

		hub.publish('user-1', realtimeMessage('t', {}));

		expect(mine.sent).toHaveLength(1);
		expect(theirs.sent).toHaveLength(0);
	});

	test('unregister stops delivery and is safe for an unknown id', () => {
		const hub = new InProcessRealtimeHub();
		const socket = recordingSocket();
		hub.register('ws-1', 'user-1', socket);
		hub.unregister('ws-1');
		hub.unregister('ws-1');

		expect(hub.publish('user-1', realtimeMessage('t', {}))).toBe(0);
		expect(socket.sent).toHaveLength(0);
		expect(hub.connectionCount()).toBe(0);
	});

	test('a socket that throws on send is dropped, its sibling still receives', () => {
		const hub = new InProcessRealtimeHub();
		const dead: TRealtimeSocket = {
			send() {
				throw new Error('closed');
			},
		};
		const alive = recordingSocket();
		hub.register('ws-dead', 'user-1', dead);
		hub.register('ws-alive', 'user-1', alive);

		expect(hub.publish('user-1', realtimeMessage('t', {}))).toBe(1);
		expect(alive.sent).toHaveLength(1);
		// The dead connection is gone, so the next publish only sees one.
		expect(hub.connectionCount('user-1')).toBe(1);
	});
});
