import * as React from "react";
import { actions } from "astro:actions";
import { Flashlight, Hash, Keyboard, MapPin, ShieldCheck, X } from "lucide-react";
import { errorText, fieldBox, fieldInput, fieldLabel, primaryButton } from "../../components/customer/formStyles";

/**
 * 08.06 Register Device. Scans the device-label QR with the camera (BarcodeDetector,
 * where supported) and falls back to manual serial entry.
 */
type Device = { productId: string; name: string; serial: string; order: string; site: string; warrantyMonths: number };
type CameraState = "starting" | "scanning" | "unsupported" | "denied";

// Minimal typing for the Shape Detection API (Chromium/Android; not in lib.dom yet).
type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => Detector;
  }
}

const SERIAL = /[A-Z0-9]{2,4}-\d{4}-\d{2}/i;
const untilLabel = (months: number) => {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
};

export default function RegisterDevice() {
  const video = React.useRef<HTMLVideoElement>(null);
  const stream = React.useRef<MediaStream | null>(null);
  const [camera, setCamera] = React.useState<CameraState>("starting");
  const [torch, setTorch] = React.useState<boolean | null>(null); // null = torch not supported
  const [device, setDevice] = React.useState<Device>();
  const [manual, setManual] = React.useState(false);
  const [serial, setSerial] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const lookingUp = React.useRef(false);

  const lookup = React.useCallback(async (value: string) => {
    if (lookingUp.current) return;
    lookingUp.current = true;
    setPending(true);
    setError(undefined);
    const form = new FormData();
    form.set("serial", value);
    const { data, error: actionError } = await actions.portal.lookupDevice(form);
    lookingUp.current = false;
    setPending(false);
    if (actionError) return setError(actionError.message);
    setDevice(data);
    setManual(false);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    async function start() {
      if (!window.BarcodeDetector || !navigator.mediaDevices?.getUserMedia) return setCamera("unsupported");
      try {
        const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (cancelled) return media.getTracks().forEach((t) => t.stop());
        stream.current = media;
        const track = media.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
        setTorch(caps.torch ? false : null);
        if (video.current) {
          video.current.srcObject = media;
          await video.current.play();
        }
        setCamera("scanning");
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        const tick = async () => {
          if (cancelled || !video.current) return;
          try {
            const codes = await detector.detect(video.current);
            const match = codes.map((c) => c.rawValue.match(SERIAL)?.[0]).find(Boolean);
            if (match) await lookup(match.toUpperCase());
          } catch {
            /* frame not ready */
          }
          timer = window.setTimeout(tick, 400);
        };
        tick();
      } catch {
        setCamera("denied");
      }
    }
    start();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, [lookup]);

  async function toggleTorch() {
    const track = stream.current?.getVideoTracks()[0];
    if (!track || torch === null) return;
    await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
    setTorch(!torch);
  }

  async function register() {
    if (!device) return;
    setPending(true);
    setError(undefined);
    const form = new FormData();
    form.set("serial", device.serial);
    const { error: actionError } = await actions.portal.registerDevice(form);
    if (actionError) {
      setPending(false);
      return setError(actionError.message);
    }
    location.assign("/products");
  }

  const scanHint =
    camera === "scanning"
      ? device
        ? "Device detected"
        : "Point at the QR label on the device"
      : camera === "starting"
        ? "Starting camera…"
        : camera === "denied"
          ? "Camera access was blocked — enter the serial manually"
          : "Scanning isn't supported on this browser — enter the serial manually";

  return (
    <div className="flex min-h-dvh flex-col bg-[#060F26]">
      <div className="flex items-center justify-between gap-2.5 px-5 py-1.5">
        <a href="/products" aria-label="Close" className="flex size-10 items-center justify-center rounded-pill bg-white/12 text-white">
          <X className="size-5" aria-hidden="true" />
        </a>
        <h1 className="font-heading text-[17px] font-bold text-white">Register device</h1>
        <button
          type="button"
          onClick={toggleTorch}
          disabled={torch === null}
          aria-pressed={torch ?? undefined}
          aria-label="Flashlight"
          className="flex size-10 items-center justify-center rounded-pill bg-white/12 text-white disabled:opacity-40"
        >
          <Flashlight className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="relative flex h-[300px] flex-col items-center justify-center gap-[18px] overflow-hidden">
        <video ref={video} muted playsInline className="absolute inset-0 size-full object-cover" aria-hidden="true" />
        <span className="absolute inset-0 bg-[#060F26A6]" aria-hidden="true" />
        <span className="relative flex size-[190px] items-center justify-center rounded-xl ring-3 ring-cyan-400" aria-hidden="true">
          {camera === "scanning" && !device && <span className="h-0.5 w-[150px] animate-pulse bg-cyan-400 shadow-[0_0_12px_#22D3EECC]" />}
        </span>
        <p className="relative px-6 text-center text-[14px] font-semibold text-white" role="status">{scanHint}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 rounded-t-sheet bg-white px-5 pb-safe">
        <div className="flex justify-center pt-2.5 pb-1.5" aria-hidden="true">
          <span className="h-[5px] w-10 rounded-pill bg-border-strong" />
        </div>

        {device && !manual ? (
          <>
            <div className="flex items-center gap-3">
              <span className="size-14 shrink-0 rounded-md bg-[linear-gradient(135deg,var(--eg-blue-50)_0%,var(--eg-surface-2)_60%,var(--eg-cyan-50)_100%)]" aria-hidden="true" />
              <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                <span className="flex items-center gap-1.5 rounded-pill bg-success-bg px-2.5 py-[5px] text-[12px] font-semibold text-success">
                  <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                  Device detected
                </span>
                <span className="text-[16px] font-extrabold text-fg">{device.name}</span>
                <span className="text-[12.5px] text-fg-muted">SN {device.serial} · Order {device.order}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className={fieldLabel}>Installed at</span>
              <div className={fieldBox}>
                <MapPin className="size-[18px] shrink-0 text-fg-muted" aria-hidden="true" />
                <span className="flex-1 text-[15px] text-fg">{device.site}</span>
              </div>
            </div>
            <p className="flex items-center gap-2.5 rounded-md bg-success-bg p-3.5 text-[13px] leading-[19px] font-semibold text-success">
              <ShieldCheck className="size-[18px] shrink-0" aria-hidden="true" />
              {device.warrantyMonths / 12}-year warranty activates today · until {untilLabel(device.warrantyMonths)}
            </p>
            {error && <p role="alert" className={errorText}>{error}</p>}
            <button type="button" onClick={register} disabled={pending} className={primaryButton}>
              {pending ? "Registering…" : "Register & activate warranty"}
            </button>
          </>
        ) : (
          <form
            id="manual"
            onSubmit={(e) => {
              e.preventDefault();
              if (!SERIAL.test(serial)) return setError("Serial numbers look like BG5-0418-03.");
              lookup(serial.trim().toUpperCase());
            }}
            className="flex flex-col gap-4"
            noValidate
          >
            <div className="flex flex-col gap-1">
              <h2 className="font-heading text-[18px] font-extrabold text-fg">Enter serial number</h2>
              <p className="text-[13.5px] leading-5 text-fg-secondary">You’ll find it on the label next to the QR code, e.g. BG5-0418-03.</p>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="serial" className={fieldLabel}>Serial number</label>
              <div className={fieldBox}>
                <Hash className="size-[18px] shrink-0 text-fg-muted" aria-hidden="true" />
                <input
                  id="serial"
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={40}
                  placeholder="BG5-0418-03"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "serial-error" : undefined}
                  className={`${fieldInput} uppercase placeholder:normal-case`}
                />
              </div>
              {error && <p id="serial-error" role="alert" className={errorText}>{error}</p>}
            </div>
            <button type="submit" disabled={pending || !serial.trim()} className={primaryButton}>
              {pending ? "Looking up…" : "Find device"}
            </button>
          </form>
        )}

        {device && !manual && (
          <button type="button" onClick={() => { setManual(true); setError(undefined); }} className="flex items-center justify-center gap-1.5 py-1 text-[13.5px] font-semibold text-blue-600">
            <Keyboard className="size-3.5" aria-hidden="true" />
            Enter serial number manually
          </button>
        )}
      </div>
    </div>
  );
}
