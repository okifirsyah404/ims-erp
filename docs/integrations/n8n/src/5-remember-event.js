// n8n Code node "5b. Finish".
//
// "5a. Record event" already stored the event id in `erp_processed_events`
// (only reached when the WhatsApp sends succeeded). This sets the HTTP answer
// for the last node: 200 when handled or skipped, or the earlier 400/401.
const item = $('4. Send WhatsApp (WAHA / Meta)').first().json;
if (item.httpStatus) return [{ json: item }];

const count = (item.messages || []).length;
const skipped = (item.skippedWithoutTemplate || []).length;
return [
	{
		json: {
			...item,
			httpStatus: 200,
			result:
				(count === 0 ? 'no message for this event' : count + ' message(s) handled') +
				(skipped ? ', ' + skipped + ' skipped (no Meta template)' : ''),
		},
	},
];
