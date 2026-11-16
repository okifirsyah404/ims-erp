// n8n Code node "2. Skip duplicates".
//
// The ERP retries a failed delivery and an admin can "send again" from
// /integrations/webhooks: both re-send the same event id. Ids handled before
// are kept in the workflow's static data (saved only for executions of the
// ACTIVE workflow, not for manual test runs), the newest 5000.
const item = $input.first().json;
if (item.httpStatus) return [{ json: item }];

const memory = $getWorkflowStaticData('global');
const seen = Array.isArray(memory.processedEventIds) ? memory.processedEventIds : [];
if (seen.includes(item.eventId)) {
	return [{ json: { ...item, httpStatus: 200, result: 'duplicate, already handled' } }];
}
return [{ json: item }];
