import { createHmac, timingSafeEqual } from 'node:crypto';
import type { TInboundMessage } from '../contracts/whatsapp.contract';

/**
 * Pure helpers of the WhatsApp assistant (M04 stage 2): reading WAHA
 * webhooks, their signature, the hard guards and FAQ matching.
 */

/** WAHA signs the raw body: `X-Webhook-Hmac` = hex HMAC-SHA512 with the webhook key. */
export function verifyWahaSignature(secret: string, rawBody: string, header: string | null): boolean {
	if (!header) return false;
	const expected = Buffer.from(createHmac('sha512', secret).update(rawBody).digest('hex'));
	const given = Buffer.from(header.trim().toLowerCase());
	return expected.length === given.length && timingSafeEqual(expected, given);
}

const PERSONAL_CHAT = /@(c\.us|s\.whatsapp\.net|lid)$/;

/**
 * The customer message in a WAHA webhook, or `null` for anything to ignore:
 * other events, our own messages, groups, status updates and channels.
 */
export function parseWahaWebhook(body: unknown): TInboundMessage | null {
	if (!body || typeof body !== 'object') return null;
	const { event, payload } = body as { event?: unknown; payload?: Record<string, unknown> };
	if (event !== 'message' || !payload || typeof payload !== 'object') return null;
	const from = typeof payload.from === 'string' ? payload.from : '';
	const id = typeof payload.id === 'string' ? payload.id : '';
	if (!id || payload.fromMe === true || !PERSONAL_CHAT.test(from)) return null;
	const data = payload._data as { notifyName?: unknown } | undefined;
	const notifyName = typeof data?.notifyName === 'string' ? data.notifyName.trim().slice(0, 200) : '';
	return {
		externalId: id.slice(0, 128),
		chatId: from.slice(0, 128),
		phone: from.split('@')[0].replace(/\D/g, '').slice(0, 32),
		contactName: notifyName || null,
		body: typeof payload.body === 'string' ? payload.body.slice(0, 4000) : '',
		hasMedia: payload.hasMedia === true,
	};
}

const normalize = (text: string) =>
	text
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^\p{L}\p{N}\s]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim();

/**
 * Discounts, prices off-list and transactions: never handled by the
 * assistant (owner decision; M04 controls). Checked on the customer's
 * message and again on the assistant's answer.
 */
const RESTRICTED = [
	/\bdiskon\b/,
	/\bdiscount\b/,
	/\bpotongan( harga)?\b/,
	/\bkorting\b/,
	/\bnego(siasi)?\b/,
	/\bharga (khusus|spesial|special|teman|nett?)\b/,
	/\b(kurang|turun)(in|kan)? (harga|dikit|sedikit)\b/,
	/\bcicil(an)?\b/,
	/\bkredit\b/,
	/\brefund\b/,
	/\bpengembalian dana\b/,
	/\b(no|nomor|nomer) ?rek(ening)?\b/,
	/\btransfer ke\b/,
	/\b(bayar|pembayaran|lunasi|lunas) (sekarang|ke|via|lewat)\b/,
	/\b(buat|buatkan|bikin|bikinkan|terbitkan|kirim|kirimkan) (invoice|tagihan|faktur|kwitansi|kuitansi|pesanan|order|po)\b/,
	/\b(checkout|order sekarang|pesan sekarang)\b/,
	/\bgratis(kan)?\b/,
	/\bpromo\b/,
];

export function isRestricted(text: string): boolean {
	const value = normalize(text);
	return RESTRICTED.some((pattern) => pattern.test(value));
}

const HUMAN = [/\b(admin|cs|customer service|operator|manusia|orang|petugas|sales|marketing)\b/, /\b(telepon|telpon|hubungi) (saya|aku)\b/];

/** The customer asks for a person. */
export function wantsHuman(text: string): boolean {
	const value = normalize(text);
	return HUMAN.some((pattern) => pattern.test(value));
}

const STOP_WORDS = new Set(
	'yang dan atau di ke dari untuk dengan ini itu apa apakah ada bisa saya aku kami kamu anda mau ingin tolong mohon min kak gan pak bu dong ya yah kah tidak gak nggak berapa bagaimana gimana kapan dimana mana the and for is are what how can you'.split(
		' ',
	),
);

/** Meaningful words of a text (lowercase, no punctuation, no stop words). */
export function words(text: string): string[] {
	return [...new Set(normalize(text).split(' ').filter((word) => word.length >= 3 && !STOP_WORDS.has(word)))];
}

/** FAQ entries ranked by shared words with the question (question and keywords count). */
export function rankFaqs<T extends { question: string; keywords: string | null }>(text: string, entries: T[], limit = 5): T[] {
	const asked = new Set(words(text));
	if (asked.size === 0) return [];
	return entries
		.map((entry) => ({ entry, score: words(`${entry.question} ${entry.keywords ?? ''}`).filter((word) => asked.has(word)).length }))
		.filter(({ score }) => score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit)
		.map(({ entry }) => entry);
}

/** Replies the ERP sends by itself (Indonesian business copy). */
export const SYSTEM_REPLIES = {
	handoff: 'Terima kasih, pesan Anda sudah kami terima dan akan dibalas oleh admin kami secepatnya.',
	restricted:
		'Mohon maaf, untuk harga khusus, diskon, pembayaran, atau pesanan kami bantu langsung lewat admin. Pesan Anda sudah kami teruskan ke admin kami.',
} as const;
