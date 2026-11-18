import * as React from "react";
import { actions } from "astro:actions";
import { ClipboardCheck, Info, MapPin, Package, ScanSearch, Wrench } from "lucide-react";
import { errorText, primaryButton } from "../../components/customer/formStyles";

/** 08.04 Service Booking. Books through actions.portal.bookService. */
type ServiceTypeId = "repair" | "maintenance" | "inspection";
type Props = {
  types: { id: ServiceTypeId; name: string; priceLabel: string }[];
  days: { date: string; weekday: string; day: number; available: boolean; slots: { time: string; available: boolean }[] }[];
  devices: { id: string; name: string; detail: string; underWarranty: boolean }[];
  site: { name: string; detail: string };
  initialDevice?: string;
  /** Where to go once booked (the originating ticket, or the support list). */
  returnTo: string;
};

const typeIcons = { repair: Wrench, maintenance: ClipboardCheck, inspection: ScanSearch };
const sectionTitle = "text-[15px] font-bold text-fg";
const monthLabel = (iso: string) => new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`)).replace(/^(\w+) /, "$1, ");
const plusTwoHours = (time: string) => `${String(Number(time.slice(0, 2)) + 2).padStart(2, "0")}${time.slice(2)}`;

export default function BookServiceForm({ types, days, devices, site, initialDevice, returnTo }: Props) {
  const firstDay = days.find((d) => d.available);
  const [type, setType] = React.useState<ServiceTypeId>(types[0]?.id ?? "repair");
  const [deviceId, setDeviceId] = React.useState(initialDevice ?? devices[0]?.id ?? "");
  const [date, setDate] = React.useState(firstDay?.date ?? "");
  const [time, setTime] = React.useState(firstDay?.slots.find((s) => s.available)?.time ?? "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const device = devices.find((d) => d.id === deviceId);
  const day = days.find((d) => d.date === date);
  const covered = Boolean(device?.underWarranty) && type !== "inspection";

  function pickDay(next: (typeof days)[number]) {
    setDate(next.date);
    if (!next.slots.some((s) => s.time === time && s.available)) setTime(next.slots.find((s) => s.available)?.time ?? "");
  }

  async function confirm() {
    setPending(true);
    setError(undefined);
    const form = new FormData();
    form.set("service_type", type);
    form.set("product", deviceId);
    form.set("date", date);
    form.set("time", time);
    const { error: actionError } = await actions.portal.bookService(form);
    if (actionError) {
      setPending(false);
      return setError(actionError.message);
    }
    location.assign(returnTo);
  }

  return (
    <div className="flex flex-col gap-[22px] px-5 pt-2 pb-6">
      <section className="flex flex-col gap-3">
        <h2 className={sectionTitle} id="type-label">Service type</h2>
        <div className="flex flex-col gap-2.5" role="radiogroup" aria-labelledby="type-label">
          {types.map((t) => {
            const Icon = typeIcons[t.id];
            const on = t.id === type;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setType(t.id)}
                className={`flex items-center gap-3 rounded-lg px-3.5 py-3 text-left ${on ? "bg-navy-900" : "bg-surface"}`}
              >
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-md ${on ? "bg-white/12 text-cyan-400" : "bg-white text-blue-600"}`} aria-hidden="true">
                  <Icon className="size-[18px]" />
                </span>
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className={`text-[14px] font-bold ${on ? "text-white" : "text-fg"}`}>{t.name}</span>
                  <span className={`text-[11.5px] font-medium ${on ? "text-fg-on-dark-muted" : "text-fg-muted"}`}>{t.priceLabel}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {devices.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2.5">
            <h2 className={sectionTitle} id="device-label">Device</h2>
            <span className="text-[13px] font-semibold text-blue-600" aria-hidden="true">Change</span>
          </div>
          <div className="relative flex items-center gap-3 rounded-lg p-3 ring-1 ring-border ring-inset focus-within:ring-[1.5px] focus-within:ring-blue-600">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-surface text-fg-muted" aria-hidden="true">
              <Package className="size-6" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[14.5px] font-bold text-fg">{device?.name}</span>
              <span className="truncate text-[12px] text-fg-muted">{device?.detail}</span>
            </span>
            {device?.underWarranty && (
              <span className="flex items-center gap-1.5 rounded-pill bg-success-bg px-2.5 py-[5px] text-[12px] font-semibold text-success">
                <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                Warranty
              </span>
            )}
            <select aria-labelledby="device-label" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
              {devices.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2.5">
          <h2 className={sectionTitle} id="date-label">{date ? monthLabel(date) : "Date"}</h2>
          <span className="text-[13px] font-semibold text-blue-600/60" title="More dates will be available once connected to the ERP">Calendar</span>
        </div>
        <div className="flex gap-2" role="radiogroup" aria-labelledby="date-label">
          {days.map((d) => {
            const on = d.date === date;
            return (
              <button
                key={d.date}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={dayLabel(d.date)}
                disabled={!d.available}
                onClick={() => pickDay(d)}
                className={`flex flex-1 flex-col items-center gap-1 rounded-control py-3 disabled:opacity-45 ${on ? "bg-blue-600" : "bg-surface"}`}
              >
                <span className={`text-[11.5px] font-semibold ${on ? "text-white/80" : "text-fg-muted"}`}>{d.weekday}</span>
                <span className={`font-heading text-[18px] font-extrabold ${on ? "text-white" : "text-fg"}`}>{d.day}</span>
                <span className={`size-[5px] rounded-full ${!d.available ? "bg-transparent" : on ? "bg-white" : "bg-success"}`} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={sectionTitle} id="slot-label">Available slots</h2>
        <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-labelledby="slot-label">
          {day?.slots.map((s) => {
            const on = s.time === time;
            return (
              <button
                key={s.time}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={!s.available}
                onClick={() => setTime(s.time)}
                className={
                  on
                    ? "flex h-[46px] items-center justify-center rounded-md bg-blue-50 text-[14px] font-bold text-blue-700 ring-[1.5px] ring-blue-600 ring-inset"
                    : "flex h-[46px] items-center justify-center rounded-md bg-white text-[14px] font-medium text-fg ring-1 ring-border ring-inset disabled:opacity-45"
                }
              >
                {s.available ? s.time : `${s.time} · Full`}
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2.5">
          <h2 className={sectionTitle}>Service location</h2>
          <span className="text-[13px] font-semibold text-blue-600/60" title="Contact your account manager to change service sites">Edit</span>
        </div>
        <div className="flex items-center gap-3.5 rounded-card bg-white px-4 py-[18px] ring-1 ring-border ring-inset">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600" aria-hidden="true">
            <MapPin className="size-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="text-[15px] font-semibold text-fg">{site.name}</span>
            <span className="text-[13px] text-fg-muted">{site.detail}</span>
          </span>
        </div>
      </section>

      <p className="flex gap-2.5 rounded-control bg-[#E7FAFD] p-3.5 text-[12.5px] leading-[18px] text-navy-800">
        <Info className="mt-px size-4 shrink-0" aria-hidden="true" />
        Technician will arrive within the slot window. Please arrange site access and parking for the service vehicle.
      </p>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/96 shadow-[0_-8px_24px_#0A1A3F14] backdrop-blur-[20px]">
        <div className="app-column flex flex-col gap-2.5 px-5 pt-3.5 pb-safe">
          {error && <p role="alert" className={errorText}>{error}</p>}
          <div className="flex items-center justify-between gap-2.5">
            <span className="text-[13px] text-fg-muted">{date && time ? `${dayLabel(date)} · ${time}–${plusTwoHours(time)}` : "Pick a date and time"}</span>
            <span className={`font-heading text-[14px] font-extrabold ${covered ? "text-success" : "text-fg"}`}>
              {covered ? "Covered by warranty" : types.find((t) => t.id === type)?.priceLabel}
            </span>
          </div>
          <button type="button" onClick={confirm} disabled={pending || !date || !time || !deviceId} className={primaryButton}>
            {pending ? "Booking…" : "Confirm booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
