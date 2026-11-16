// n8n Code node "5. Remember event and answer".
//
// Marks the event as handled (only after the WhatsApp sends succeeded) and
// sets the HTTP answer for the last node: 200 when handled or skipped.
const item = $input.first().json;
if (item.httpStatus) return [{ json: item }];

const memory = $getWorkflowStaticData('global');
const seen = Array.isArray(memory.processedEventIds) ? memory.processedEventIds : [];
seen.push(item.eventId);
memory.processedEventIds = seen.slice(-5000);

const count = (item.messages || []).length;
return [
	{
		json: {
			...item,
			httpStatus: 200,
			result: count === 0 ? 'no message for this event' : count + ' message(s) handled',
		},
	},
];
