ALTER TABLE "inventory"."borrowing_events" DROP CONSTRAINT "borrowing_events_borrowing_id_borrowings_id_fkey";--> statement-breakpoint
ALTER TABLE "inventory"."borrowing_events" DROP CONSTRAINT "borrowing_events_borrowing_line_id_borrowing_lines_id_fkey";--> statement-breakpoint
ALTER TABLE "inventory"."borrowing_lines" DROP CONSTRAINT "borrowing_lines_borrowing_id_borrowings_id_fkey";--> statement-breakpoint
-- Hand-written (ERP-0036 Slice 3): this FK was created manually in
-- 20261102174836_colorful_rattler and never lived in the Drizzle metadata, so
-- drizzle-kit does not know to drop it before dropping `borrowing_lines`.
-- The column itself stays as superseded (D17) and is removed in a later slice.
ALTER TABLE "inventory"."serial_tracked_items" DROP CONSTRAINT "serial_tracked_items_current_borrowing_line_id_borrowing_lines_id_fkey";--> statement-breakpoint
DROP TABLE "inventory"."borrowing_events";--> statement-breakpoint
DROP TABLE "inventory"."borrowing_lines";--> statement-breakpoint
DROP TABLE "inventory"."borrowings";--> statement-breakpoint
DROP TABLE "assets"."asset_assignments";--> statement-breakpoint
ALTER TABLE "assets"."borrowings" ADD COLUMN "tool_set_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory"."serial_tracked_items" DROP CONSTRAINT "serial_tracked_items_status_check", ADD CONSTRAINT "serial_tracked_items_status_check" CHECK (status IN ('pre_order', 'in_stock', 'lost', 'sold', 'applied_warranty'));