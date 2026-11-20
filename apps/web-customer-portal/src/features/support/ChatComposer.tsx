import * as React from "react";
import { actions, isInputError } from "astro:actions";
import { Camera, FileText, Paperclip, SendHorizontal, X } from "lucide-react";
import { cn } from "cn";
import { TICKET_ATTACHMENTS_ENABLED } from "@/lib/support";

/**
 * 08.03 composer + quick replies. Messages (with up to 3 photo/PDF attachments) go
 * through actions.portal.postMessage and the page reloads to render the updated thread
 * server-side. `inline` renders inside the desktop conversation pane (06.06) instead of
 * the fixed mobile footer.
 */
type Props = { ticketId: string; agentFirstName: string; quickReplies: string[]; variant?: "fixed" | "inline" };

const MAX_FILES = 3;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/*,application/pdf";

export default function ChatComposer({ ticketId, agentFirstName, quickReplies, variant = "fixed" }: Props) {
  const [text, setText] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const fileInput = React.useRef<HTMLInputElement>(null);
  const cameraInput = React.useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = [...list];
    const invalidType = incoming.find((f) => !f.type.startsWith("image/") && f.type !== "application/pdf");
    const tooBig = incoming.find((f) => f.size > MAX_BYTES);
    if (invalidType) return setError(`${invalidType.name} isn't a photo or PDF.`);
    if (tooBig) return setError(`${tooBig.name} is larger than 10 MB.`);
    const next = [...files, ...incoming].slice(0, MAX_FILES);
    if (files.length + incoming.length > MAX_FILES) setError(`You can attach up to ${MAX_FILES} files per message.`);
    else setError(undefined);
    setFiles(next);
  }

  async function send(message: string) {
    const value = message.trim();
    if ((!value && files.length === 0) || pending) return;
    setPending(true);
    setError(undefined);
    const form = new FormData();
    form.set("ticket", ticketId);
    if (value) form.set("text", value);
    files.forEach((file) => form.append("attachments", file, file.name));
    const { error: actionError } = await actions.portal.postMessage(form);
    if (actionError) {
      setPending(false);
      return setError(isInputError(actionError) ? Object.values(actionError.fields).flat()[0] ?? actionError.message : actionError.message);
    }
    location.replace(`${location.pathname}#latest`);
    location.reload();
  }

  const canSend = !pending && (text.trim().length > 0 || files.length > 0);
  const inline = variant === "inline";

  return (
    <>
      {quickReplies.length > 0 && (
        <div className={cn("flex flex-wrap items-center justify-end gap-2", inline && "px-6 pb-3")} role="group" aria-label="Quick replies">
          {quickReplies.map((reply) => (
            <button
              key={reply}
              type="button"
              disabled={pending}
              onClick={() => send(reply)}
              className="rounded-pill px-3 py-2 text-[12.5px] font-semibold text-blue-600 ring-[1.2px] ring-blue-600 ring-inset hover:bg-blue-50 disabled:opacity-60"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className={inline ? "border-t border-border bg-white" : "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/96 backdrop-blur-[10px]"}
      >
        <div className={cn("flex flex-col gap-2", inline ? "px-5 py-3.5" : "app-column px-3 pt-2.5 pb-safe md:max-w-[640px] xl:max-w-[760px]")}>
          {error && (
            <p role="alert" className="px-2 text-[13px] font-semibold text-danger">
              {error}
            </p>
          )}
          {files.length > 0 && (
            <ul className="flex flex-wrap gap-2 px-1" aria-label="Attachments">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex max-w-[220px] items-center gap-2 rounded-pill bg-surface py-1.5 pr-1.5 pl-3 text-[12.5px] font-semibold text-fg">
                  <FileText className="size-4 shrink-0 text-blue-600" aria-hidden="true" />
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((_, i) => i !== index))}
                    className="flex size-6 shrink-0 items-center justify-center rounded-pill hover:bg-surface-2"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2">
            {TICKET_ATTACHMENTS_ENABLED && (
              <>
                <input ref={fileInput} type="file" accept={ACCEPT} multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
                <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={pending || files.length >= MAX_FILES}
                  aria-label="Attach photo or PDF"
                  className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-surface text-fg hover:bg-surface-2 disabled:text-fg-muted"
                >
                  <Paperclip className="size-5" aria-hidden="true" />
                </button>
              </>
            )}
            <label className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-pill bg-surface px-4 focus-within:ring-[1.5px] focus-within:ring-blue-600">
              <span className="sr-only">Message {agentFirstName}</span>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={2000}
                placeholder={`Message ${agentFirstName}…`}
                className="min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-fg-muted"
              />
              {TICKET_ATTACHMENTS_ENABLED && (
                <button
                  type="button"
                  onClick={() => cameraInput.current?.click()}
                  disabled={pending || files.length >= MAX_FILES}
                  aria-label="Take a photo"
                  className="shrink-0 text-fg-muted hover:text-fg disabled:opacity-50 md:hidden"
                >
                  <Camera className="size-[18px]" aria-hidden="true" />
                </button>
              )}
            </label>
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send message"
              className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <SendHorizontal className="size-[18px]" aria-hidden="true" />
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
