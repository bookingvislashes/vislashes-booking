"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ScheduleDay,
  formatLongDate,
  formatRange,
  to12Hour,
} from "@/lib/schedule";

interface Conflict {
  id: string;
  time_slot: string;
  client: string | null;
}

interface DayEditorProps {
  day: ScheduleDay;
  /** Refetch the range after a successful write. */
  onChanged: () => void | Promise<void>;
}

type Action =
  | { action: "set-hours"; date: string; isOpen: true; startTime: string; endTime: string }
  | { action: "set-hours"; date: string; isOpen: false }
  | { action: "clear-hours"; date: string }
  | { action: "add-block"; date: string; startTime?: string; endTime?: string; reason?: string }
  | { action: "remove-block"; blockId: string };

/**
 * Everything about one date, and the only place her availability is edited.
 *
 * The write route refuses any change that would strand a confirmed booking and
 * returns the appointments in the way, which this renders by name and time.
 * Cancelling one is deliberately NOT offered here — a deposit has been taken,
 * so that decision belongs on the booking's own page where the refund wording
 * lives.
 */
export function DayEditor({ day, onChanged }: DayEditorProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  // Seeded from the current window so "open late" is a small edit, not retyping.
  const [start, setStart] = useState(day.window?.start ?? "09:00");
  const [end, setEnd] = useState(day.window?.end ?? "17:00");
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");

  const send = async (body: Action) => {
    setBusy(true);
    setError(null);
    setConflicts([]);
    try {
      const res = await fetch("/api/admin/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));

      if (res.status === 409) {
        setConflicts(json.conflicts || []);
        setError(json.message || "That clashes with an appointment.");
        return;
      }
      if (!res.ok) {
        setError(json.error || "Couldn't save that. Please try again.");
        return;
      }

      setBlockStart("");
      setBlockEnd("");
      setBlockReason("");
      await onChanged();
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const fullDayBlock = day.blocks.find((b) => b.start === null);
  const partialBlocks = day.blocks.filter((b) => b.start !== null);

  return (
    <div className="flex flex-col gap-5">
      {/* Where the day stands right now, in one line. */}
      <div>
        <p className="font-sans text-[14px] text-charcoal">
          {day.window ? (
            <>
              Open <strong>{formatRange(day.window.start, day.window.end)}</strong>
              {day.hasOverride ? (
                <span className="text-muted"> — just for this date</span>
              ) : (
                <span className="text-muted"> — your usual hours for this day</span>
              )}
            </>
          ) : (
            <strong className="text-danger">Closed all day</strong>
          )}
        </p>
        {day.overrideNote && (
          <p className="font-sans text-[13px] text-muted mt-1">
            {day.overrideNote}
          </p>
        )}
      </div>

      {/* Appointments already booked. Shown first: they are the reason a change
          might be refused, so she should see them before trying. */}
      <section>
        <h3 className="font-sans text-[13px] font-bold text-dark-brown mb-2">
          Appointments
        </h3>
        {day.bookings.length === 0 ? (
          <p className="font-sans text-[13px] text-muted">Nothing booked.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {day.bookings.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/admin/bookings/${b.id}`}
                  className="flex items-center justify-between gap-3 py-2 px-3 bg-cream rounded-control hover:bg-light-tan/50 transition-colors"
                >
                  <span className="font-sans text-[13px] text-charcoal min-w-0">
                    <strong>{b.timeSlot}</strong>
                    {b.client ? ` — ${b.client}` : ""}
                    {b.service && (
                      <span className="text-muted block truncate">
                        {b.service}
                      </span>
                    )}
                  </span>
                  <span className="font-sans text-[12px] text-muted shrink-0">
                    ends {to12Hour(b.end)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Hours for this date only. */}
      <section>
        <h3 className="font-sans text-[13px] font-bold text-dark-brown mb-2">
          Hours for this date
        </h3>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            aria-label="Opening time"
            className="bg-white border border-light-tan rounded-control px-2 py-1.5 text-[16px] font-sans focus:outline-none focus:border-deep-brown"
          />
          <span className="text-muted text-[14px]">to</span>
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            aria-label="Closing time"
            className="bg-white border border-light-tan rounded-control px-2 py-1.5 text-[16px] font-sans focus:outline-none focus:border-deep-brown"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              send({
                action: "set-hours",
                date: day.date,
                isOpen: true,
                startTime: start,
                endTime: end,
              })
            }
          >
            Use these hours
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={() =>
              send({ action: "set-hours", date: day.date, isOpen: false })
            }
          >
            Close this day
          </Button>
          {day.hasOverride && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => send({ action: "clear-hours", date: day.date })}
            >
              Back to usual hours
            </Button>
          )}
        </div>
      </section>

      {/* Blocks carved out of an open day. */}
      <section>
        <h3 className="font-sans text-[13px] font-bold text-dark-brown mb-2">
          Blocked time
        </h3>

        {day.blocks.length === 0 ? (
          <p className="font-sans text-[13px] text-muted mb-3">
            Nothing blocked on this date.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5 mb-3">
            {fullDayBlock && (
              <li className="flex items-center justify-between gap-2 py-2 px-3 bg-cream rounded-control">
                <span className="font-sans text-[13px] text-charcoal">
                  <strong>All day</strong>
                  {fullDayBlock.reason ? ` — ${fullDayBlock.reason}` : ""}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    send({ action: "remove-block", blockId: fullDayBlock.id })
                  }
                  className="text-danger text-[18px] leading-none cursor-pointer shrink-0 disabled:opacity-50"
                  aria-label="Remove this block"
                >
                  &times;
                </button>
              </li>
            )}
            {partialBlocks.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-2 py-2 px-3 bg-cream rounded-control"
              >
                <span className="font-sans text-[13px] text-charcoal">
                  <strong>{formatRange(b.start!, b.end!)}</strong>
                  {b.reason ? ` — ${b.reason}` : ""}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => send({ action: "remove-block", blockId: b.id })}
                  className="text-danger text-[18px] leading-none cursor-pointer shrink-0 disabled:opacity-50"
                  aria-label="Remove this block"
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2 flex-wrap mb-2">
          <input
            type="time"
            value={blockStart}
            onChange={(e) => setBlockStart(e.target.value)}
            aria-label="Block from"
            className="bg-white border border-light-tan rounded-control px-2 py-1.5 text-[16px] font-sans focus:outline-none focus:border-deep-brown"
          />
          <span className="text-muted text-[14px]">to</span>
          <input
            type="time"
            value={blockEnd}
            onChange={(e) => setBlockEnd(e.target.value)}
            aria-label="Block until"
            className="bg-white border border-light-tan rounded-control px-2 py-1.5 text-[16px] font-sans focus:outline-none focus:border-deep-brown"
          />
        </div>
        <input
          type="text"
          value={blockReason}
          onChange={(e) => setBlockReason(e.target.value)}
          placeholder="Reason (optional)"
          maxLength={200}
          className="w-full bg-white border border-light-tan rounded-control px-3 py-1.5 text-[16px] font-sans focus:outline-none focus:border-deep-brown mb-2"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !blockStart || !blockEnd}
            onClick={() =>
              send({
                action: "add-block",
                date: day.date,
                startTime: blockStart,
                endTime: blockEnd,
                reason: blockReason || undefined,
              })
            }
          >
            Block these hours
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() =>
              send({
                action: "add-block",
                date: day.date,
                reason: blockReason || undefined,
              })
            }
          >
            Block the whole day
          </Button>
        </div>
      </section>

      {error && (
        <div role="alert" className="flex flex-col gap-2">
          <p className="font-sans text-[13px] text-danger font-semibold">
            {error}
          </p>
          {conflicts.length > 0 && (
            <>
              <ul className="flex flex-col gap-1">
                {conflicts.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/admin/bookings/${c.id}`}
                      className="font-sans text-[13px] text-charcoal underline"
                    >
                      {c.time_slot}
                      {c.client ? ` — ${c.client}` : ""}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="font-sans text-[12px] text-muted">
                Move or cancel {conflicts.length === 1 ? "it" : "them"} first —
                a deposit has already been taken, so that has to be a decision
                you make on the appointment itself.
              </p>
            </>
          )}
        </div>
      )}

      <p className="font-sans text-[12px] text-muted">
        {formatLongDate(day.date)}
      </p>
    </div>
  );
}
