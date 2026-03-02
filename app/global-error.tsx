"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ padding: "40px", textAlign: "center", fontFamily: "system-ui" }}>
          <h2>Something went wrong</h2>
          <button onClick={() => reset()} style={{ marginTop: "16px", padding: "8px 24px" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
