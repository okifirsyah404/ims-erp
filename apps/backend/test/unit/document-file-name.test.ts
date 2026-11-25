/**
 * File names of registry documents (ERP-0130).
 *
 * @remarks
 * Pure helpers, so the rules are pinned here: the name comes from the title,
 * carries the Jakarta date and hour, is cut at a word boundary and never
 * collides inside one document.
 */
import { describe, expect, test } from 'bun:test';
import {
	documentFileName,
	jakartaFileStamp,
	slugifyDocumentTitle,
} from '../../src/app/document/utils/document-file-name';

describe('slugifyDocumentTitle', () => {
	test('lower-cases, strips diacritics and joins with underscores', () => {
		expect(slugifyDocumentTitle('Perjanjian Kerja - Pertiwi Jamalia')).toBe(
			'perjanjian_kerja_pertiwi_jamalia',
		);
		expect(slugifyDocumentTitle('Kuitansi — André Núñez')).toBe('kuitansi_andre_nunez');
		expect(slugifyDocumentTitle('  Faktur   #12 / 2026  ')).toBe('faktur_12_2026');
	});

	test('cuts a long title at a word boundary under the cap', () => {
		const slug = slugifyDocumentTitle('BAST - PT Maju Jaya - PRJ-0012 - pekerjaan instalasi kamera', 40);
		expect(slug.length).toBeLessThanOrEqual(40);
		expect(slug).toBe('bast_pt_maju_jaya_prj_0012_pekerjaan');
	});

	test('an empty title yields an empty slug', () => {
		expect(slugifyDocumentTitle('   ')).toBe('');
	});
});

describe('jakartaFileStamp', () => {
	test('formats dd_mm_yyyy_HHmmss in Asia/Jakarta', () => {
		// 2026-11-25T07:32:05Z is 14:32:05 in Jakarta.
		expect(jakartaFileStamp(new Date('2026-11-25T07:32:05Z'))).toBe('25_11_2026_143205');
		// 17:30 UTC is already the next Jakarta day.
		expect(jakartaFileStamp(new Date('2026-11-25T17:30:00Z'))).toBe('26_11_2026_003000');
	});
});

describe('documentFileName', () => {
	const at = new Date('2026-11-25T07:32:05Z');

	test('uses the title, the date and the extension', () => {
		expect(
			documentFileName({
				title: 'Perjanjian Kerja - Pertiwi Jamalia',
				code: '0029/DOC/DEV/XI/26',
				extension: 'pdf',
				at,
			}),
		).toBe('perjanjian_kerja_pertiwi_jamalia_25_11_2026_143205.pdf');
	});

	test('falls back to the code when the title is empty', () => {
		expect(documentFileName({ title: '  ', code: 'GR-00012', extension: 'pdf', at })).toBe(
			'gr_00012_25_11_2026_143205.pdf',
		);
	});

	test('a name already used by the document gets the next suffix', () => {
		const first = 'perjanjian_kerja_pertiwi_jamalia_25_11_2026_143205.pdf';
		expect(
			documentFileName({
				title: 'Perjanjian Kerja - Pertiwi Jamalia',
				code: 'X',
				extension: 'pdf',
				at,
				taken: [first],
			}),
		).toBe('perjanjian_kerja_pertiwi_jamalia_25_11_2026_143205_2.pdf');
	});

	test('matching a taken name ignores case', () => {
		expect(
			documentFileName({
				title: 'Faktur',
				code: 'INV-1',
				extension: 'png',
				at,
				taken: ['FAKTUR_25_11_2026_143205.PNG'],
			}),
		).toBe('faktur_25_11_2026_143205_2.png');
	});
});
