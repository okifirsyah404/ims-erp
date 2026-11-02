ALTER TABLE "inventory"."serial_tracked_items" ADD COLUMN "current_borrowing_line_id" uuid;--> statement-breakpoint
CREATE INDEX "serial_tracked_items_current_borrowing_line_id_idx" ON "inventory"."serial_tracked_items" ("current_borrowing_line_id");--> statement-breakpoint
-- Hand-written: the FK cycle `serial_tracked_items -> borrowing_lines ->
-- serial_tracked_items` cannot be expressed in schema order, so drizzle-kit
-- emits the column and index only. `ON DELETE SET NULL` rather than the usual
-- RESTRICT because a cascade delete of the borrowing already removes the unit
-- link's meaning; blocking the delete would strand a borrowing that must be
-- removable. The unit's `status` is the source of truth for custody.
ALTER TABLE "inventory"."serial_tracked_items" ADD CONSTRAINT "serial_tracked_items_current_borrowing_line_id_borrowing_lines_id_fkey" FOREIGN KEY ("current_borrowing_line_id") REFERENCES "inventory"."borrowing_lines"("id") ON DELETE SET NULL;
