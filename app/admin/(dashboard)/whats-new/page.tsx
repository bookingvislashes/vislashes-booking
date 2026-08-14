import { RELEASE_NOTES, type ChangeKind } from "@/lib/release-notes";

// Colour carries meaning here rather than decoration: "note" is the only kind
// that asks something of her, so it is the only one that reads as a warning.
const KIND_STYLES: Record<ChangeKind, { label: string; className: string }> = {
  added: { label: "New", className: "bg-success/15 text-success" },
  fixed: { label: "Fixed", className: "bg-deep-brown/15 text-deep-brown" },
  changed: { label: "Changed", className: "bg-muted/15 text-muted" },
  note: { label: "Action", className: "bg-danger/10 text-danger" },
};

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function WhatsNewPage() {
  const current = process.env.NEXT_PUBLIC_BUILD_ID?.split(" · ")[0];

  return (
    <div>
      <h1 className="font-display text-[28px] font-bold text-dark-brown mb-1">
        What&apos;s New
      </h1>
      <p className="font-sans text-[16px] text-muted mb-6 max-w-[56ch]">
        Everything that changed in the booking site and this admin, newest
        first.
      </p>

      <div className="flex flex-col gap-4">
        {RELEASE_NOTES.map((release) => {
          const isCurrent = current === `v${release.version.replace(/\.0$/, "")}`;

          return (
            <section
              key={release.version}
              className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
            >
              <div className="flex items-baseline gap-3 flex-wrap mb-3">
                <h2 className="font-display text-[18px] font-bold text-dark-brown tabular-nums">
                  v{release.version}
                </h2>
                {isCurrent && (
                  <span className="text-[12px] font-sans font-semibold text-success bg-success/15 px-2.5 py-1 rounded-full">
                    You&apos;re on this
                  </span>
                )}
                <span className="font-sans text-[12px] text-muted ml-auto">
                  {formatDate(release.date)}
                </span>
              </div>

              <ul className="flex flex-col gap-2.5">
                {release.changes.map((change, i) => {
                  const style = KIND_STYLES[change.kind];
                  return (
                    <li key={i} className="flex items-start gap-2.5">
                      <span
                        className={`text-[12px] font-sans font-semibold px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap ${style.className}`}
                      >
                        {style.label}
                      </span>
                      <span className="font-sans text-[16px] text-charcoal leading-[1.5]">
                        {change.text}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
