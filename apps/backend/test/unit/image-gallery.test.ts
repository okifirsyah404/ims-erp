import { beforeEach, describe, expect, test } from 'bun:test';
import {
	GalleryImageNotFoundError,
	GalleryLimitError,
	GalleryOrderInvalidError,
	ImageGallery,
	MAX_GALLERY_IMAGES,
	type IGalleryImageRepository,
	type TGalleryImageRow,
} from '@shared/media';

/** In-memory `<owner>_images` repository. */
function memoryRepository(): IGalleryImageRepository & { rows: TGalleryImageRow[] } {
	const rows: TGalleryImageRow[] = [];
	const live = () => [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
	return {
		rows,
		async list() {
			return live();
		},
		async add(_owner, data) {
			const row = { id: crypto.randomUUID(), ...data };
			rows.push(row);
			return row;
		},
		async updateCaption(_owner, id, caption) {
			const row = rows.find((r) => r.id === id);
			if (!row) return null;
			row.caption = caption;
			return row;
		},
		async remove(_owner, id) {
			const index = rows.findIndex((r) => r.id === id);
			if (index < 0) return false;
			rows.splice(index, 1);
			return true;
		},
		async reorder(_owner, ids) {
			for (const [index, id] of ids.entries()) {
				const row = rows.find((r) => r.id === id);
				if (row) row.sortOrder = index;
			}
		},
	};
}

// A real 1x1 PNG: uploads go through the real WebP normalisation.
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64',
);
const file = new File([PNG], 'a.png', { type: 'image/png' });
const storage = { put: async () => {}, presignGet: (key: string) => `signed:${key}` };

describe('ImageGallery', () => {
	let repo: ReturnType<typeof memoryRepository>;
	let cover: string | null;
	let gallery: ImageGallery;

	beforeEach(() => {
		repo = memoryRepository();
		cover = null;
		gallery = new ImageGallery(repo, storage as never, 'test/owners', async (_id, key) => {
			cover = key;
		});
	});

	test('the first upload becomes the cover, later ones do not', async () => {
		await gallery.add('o1', file, 'front');
		const first = cover;
		expect(first).toContain('test/owners/o1/');
		await gallery.add('o1', file, null);
		expect(cover).toBe(first);
		expect((await gallery.list('o1')).map((i) => i.sortOrder)).toEqual([0, 1]);
	});

	test('refuses more than the maximum', async () => {
		for (let i = 0; i < MAX_GALLERY_IMAGES; i++) await gallery.add('o1', file, null);
		await expect(gallery.add('o1', file, null)).rejects.toBeInstanceOf(GalleryLimitError);
	});

	test('reorder moves the new first image into the cover', async () => {
		await gallery.add('o1', file, null);
		const second = await gallery.add('o1', file, null);
		const [a] = await gallery.list('o1');
		await gallery.reorder('o1', [second.id, a.id]);
		expect(cover).toBe(repo.rows.find((r) => r.id === second.id)?.objectKey ?? null);
	});

	test('reorder rejects a list that is not exactly the live set', async () => {
		const only = await gallery.add('o1', file, null);
		await expect(gallery.reorder('o1', [])).rejects.toBeInstanceOf(GalleryOrderInvalidError);
		await expect(gallery.reorder('o1', [only.id, only.id])).rejects.toBeInstanceOf(GalleryOrderInvalidError);
		await expect(gallery.reorder('o1', [crypto.randomUUID()])).rejects.toBeInstanceOf(GalleryOrderInvalidError);
	});

	test('removing the cover promotes the next image; removing the last clears it', async () => {
		const a = await gallery.add('o1', file, null);
		const b = await gallery.add('o1', file, null);
		await gallery.remove('o1', a.id);
		expect(cover).toBe(repo.rows.find((r) => r.id === b.id)?.objectKey ?? null);
		await gallery.remove('o1', b.id);
		expect(cover).toBeNull();
		await expect(gallery.remove('o1', b.id)).rejects.toBeInstanceOf(GalleryImageNotFoundError);
	});

	test('replaceCover swaps only the cover and keeps the others', async () => {
		await gallery.add('o1', file, null);
		const keep = await gallery.add('o1', file, null);
		const replaced = await gallery.replaceCover('o1', file);
		const list = await gallery.list('o1');
		expect(list.map((i) => i.id)).toEqual([replaced.id, keep.id]);
		expect(cover).toBe(repo.rows.find((r) => r.id === replaced.id)?.objectKey ?? null);
	});

	test('removeCover on an empty gallery is a no-op', async () => {
		await gallery.removeCover('o1');
		expect(cover).toBeNull();
	});

	test('caption edit on an unknown image is a 404', async () => {
		await expect(gallery.updateCaption('o1', crypto.randomUUID(), 'x')).rejects.toBeInstanceOf(
			GalleryImageNotFoundError,
		);
	});
});
