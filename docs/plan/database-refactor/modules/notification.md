# notification - ERP-0086

Schema `notification` · folder `src/app/notification` · URL `/notifications` · phase P7

## Current

Tables notifications, notification_templates; repository notification;
controller `/notifications`; BullMQ worker + `/ws` push;
`ExportedNotificationService`. Consumer: web-admin `notification-api.ts`.

## Target (Q32)

`push_notifications` (was notifications), `push_notification_templates` (was
notification_templates). Columns unchanged; `channel` kept for future email
and WhatsApp.

## Steps

1. **dbml** - rename tables and FK.
2. **Drizzle** - `notification.schema.ts`.
3. **Repositories** - push-notification, push-notification-template.
4. **Services** - unchanged; template seed codes re-pointed to new module
   names where the code embeds them.
5. **Controllers** - `/notifications` unchanged.
6. **Consumers** - none beyond type renames.

## Exit

Worker and socket tests green.
