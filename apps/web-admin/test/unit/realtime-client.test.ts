import { describe, expect, test } from 'bun:test';

import {
	reconnectDelayMs,
	realtimeUrl,
} from '../../src/lib/realtime/realtime-client';

describe('realtime client helpers', () => {
	test('reconnect backoff doubles then caps at 30s', () => {
		expect(reconnectDelayMs(1)).toBe(1_000);
		expect(reconnectDelayMs(2)).toBe(2_000);
		expect(reconnectDelayMs(5)).toBe(16_000);
		expect(reconnectDelayMs(6)).toBe(30_000);
		expect(reconnectDelayMs(50)).toBe(30_000);
	});

	test('realtime url keeps the API host and swaps the scheme', () => {
		expect(realtimeUrl('http://localhost:3001')).toBe('ws://localhost:3001/ws');
		expect(realtimeUrl('https://erp.example.com')).toBe(
			'wss://erp.example.com/ws',
		);
	});
});
