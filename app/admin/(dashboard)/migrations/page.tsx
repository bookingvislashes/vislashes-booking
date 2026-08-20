"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type Migration = { filename: string; applied: boolean; appliedAt: string | null };

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Reads a migration's own leading comment block for its one-line summary,
// so this page doesn't carry a second, driftable copy of what each file
// does. Falls back to the filename if a file doesn't follow that shape.
function titleFromFilename(filename: string) {
  return filename
    .replace(/^\d{3}_/, "")
    .replace(/\.sql$/, "")
    .replace(/_/g, " ");
}

export default function MigrationsPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [confirmRun, setConfirmRun] = useState<Migration | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/migrations");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't load migrations.");
        return;
      }
      setConfigured(data.configured);
      setMigrations(data.migrations || []);
    } catch {
      setError("Couldn't load migrations: network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (migration: Migration) => {
    setRunning(migration.filename);
    setError(null);
    try {
      const res = await fetch("/api/admin/migrations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: migration.filename }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(`${migration.filename} failed: ${data.error}`);
        return;
      }
      await load();
    } catch {
      setError(`${migration.filename} failed: network error.`);
    } finally {
      setRunning(null);
      setConfirmRun(null);
    }
  };

  const pending = migrations.filter((m) => !m.applied);
  const applied = migrations.filter((m) => m.applied);
  const nextUp = pending[0];

  return (
    <div>
      <h1 className="font-display text-[28px] font-bold text-dark-brown mb-1">
        Migrations
      </h1>
      <p className="font-sans text-[16px] text-muted mb-6 max-w-[60ch]">
        Database schema changes — new tables or columns a feature needs.
        These never touch your services, prices, or client data; run them in
        order, oldest first.
      </p>

      {error && (
        <div className="mb-4 p-4 rounded-control bg-danger/10 text-danger font-sans text-[14px]">
          {error}
        </div>
      )}

      {loading ? (
        <p className="font-sans text-[15px] text-muted">Loading…</p>
      ) : configured === false ? (
        <div className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <p className="font-sans text-[16px] text-charcoal leading-[1.5]">
            This page isn&apos;t connected to the database yet — it needs a{" "}
            <code className="font-mono text-[14px] bg-light-tan px-1.5 py-0.5 rounded">
              SUPABASE_DB_URL
            </code>{" "}
            environment variable in Vercel.
          </p>
          <p className="font-sans text-[15px] text-muted leading-[1.5] mt-3">
            Find it in the Supabase dashboard under Project Settings →
            Database → Connection string → URI (the one with the password
            filled in, not the pooler read-only one). Add it to Vercel, then
            redeploy — env vars only take effect on the next build.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {nextUp && (
            <section className="bg-white rounded-surface p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] border-2 border-deep-brown/20">
              <div className="flex items-baseline gap-3 flex-wrap mb-2">
                <span className="text-[12px] font-sans font-semibold text-deep-brown bg-deep-brown/10 px-2.5 py-1 rounded-full">
                  Next up
                </span>
                <h2 className="font-display text-[18px] font-bold text-dark-brown">
                  {titleFromFilename(nextUp.filename)}
                </h2>
              </div>
              <p className="font-sans text-[14px] text-muted mb-4">
                {nextUp.filename}
              </p>
              <Button onClick={() => setConfirmRun(nextUp)} disabled={running !== null}>
                {running === nextUp.filename ? "Running…" : "Run this migration"}
              </Button>
            </section>
          )}

          {pending.length > 1 && (
            <section>
              <h3 className="font-sans text-[13px] font-semibold text-muted uppercase tracking-wide mb-2">
                Also pending
              </h3>
              <div className="flex flex-col gap-2">
                {pending.slice(1).map((m) => (
                  <div
                    key={m.filename}
                    className="bg-white rounded-surface p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center justify-between gap-3 flex-wrap"
                  >
                    <div>
                      <p className="font-sans text-[15px] font-semibold text-charcoal">
                        {titleFromFilename(m.filename)}
                      </p>
                      <p className="font-sans text-[13px] text-muted">{m.filename}</p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirmRun(m)}
                      disabled={running !== null}
                    >
                      {running === m.filename ? "Running…" : "Run"}
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {pending.length === 0 && (
            <p className="font-sans text-[15px] text-muted">
              Everything is up to date — no pending migrations.
            </p>
          )}

          {applied.length > 0 && (
            <section>
              <h3 className="font-sans text-[13px] font-semibold text-muted uppercase tracking-wide mb-2">
                Already applied
              </h3>
              <div className="flex flex-col gap-1">
                {applied.map((m) => (
                  <div
                    key={m.filename}
                    className="flex items-center justify-between gap-3 px-1 py-1.5 font-sans text-[14px]"
                  >
                    <span className="text-charcoal/70">{m.filename}</span>
                    <span className="text-muted text-[13px] tabular-nums">
                      {m.appliedAt ? formatDate(m.appliedAt) : ""}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <Modal
        isOpen={confirmRun !== null}
        onClose={() => setConfirmRun(null)}
        title="Run this migration?"
      >
        {confirmRun && (
          <div>
            <p className="font-sans text-[16px] text-charcoal leading-[1.5]">
              This changes the database structure — adding tables or columns a
              feature needs. It never touches your services, prices, or
              client records. This can&apos;t be undone from here.
            </p>
            <p className="font-mono text-[13px] text-muted mt-3">{confirmRun.filename}</p>
            <div className="flex gap-3 mt-5">
              <Button onClick={() => run(confirmRun)} disabled={running !== null}>
                {running ? "Running…" : "Run"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setConfirmRun(null)}
                disabled={running !== null}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
