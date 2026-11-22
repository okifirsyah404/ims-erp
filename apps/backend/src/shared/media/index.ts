/**
 * Image and file helpers shared across modules.
 *
 * @remarks
 * `product` and `inventory` both render stored image keys (ADR-0026);
 * `product`, `inventory` (assets) and `warehouse` share the multi-image
 * gallery rules.
 */
export { storedImageUrl } from './image-url';
export * from './image-gallery';
export { GalleryRepositoryBase } from './image-gallery.repository';
