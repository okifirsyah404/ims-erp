// n8n Code node "6. Email messages" (optional branch).
//
// One item per composed email, for the "Send email" node after it. That node
// is disabled after import: add SMTP credentials and enable it to use email.
// Email runs after the webhook answered, so a failed email is not retried by
// the ERP (WhatsApp is the primary channel).
const item = $input.first().json;
if (item.httpStatus !== 200) return [];
return (item.messages || [])
	.filter((message) => message.channel === 'email')
	.map((message) => ({ json: { to: message.to, subject: message.subject, text: message.text } }));
