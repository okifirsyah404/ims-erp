// n8n Code node "2c. Skip duplicates".
//
// The ERP retries a failed delivery and an admin can "send again" from
// /integrations/webhooks: both re-send the same event id. Handled ids live in
// the n8n data table `erp_processed_events` (created by "2a. Ensure table",
// written by "5a. Record event" only after WhatsApp succeeded). "2b. Look up
// event" returns the matching row, or an empty item when there is none.
//
// Why not workflow static data: it is loaded when an execution starts and
// saved when it ends, after the ERP already got its answer, so an event
// re-sent right away was not seen (found in testing).
const event = $('1. Verify ERP signature').first().json;
if (event.httpStatus) return [{ json: event }];

const found = $input.all().some((row) => row.json && row.json.event_id === event.eventId);
if (found) {
	return [{ json: { ...event, httpStatus: 200, result: 'duplicate, already handled' } }];
}
return [{ json: event }];
