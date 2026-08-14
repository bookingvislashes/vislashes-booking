/**
 * Release notes, shown in the admin at /admin/whats-new.
 *
 * ── HOW TO ADD AN ENTRY ──────────────────────────────────────────────────
 * Every time `version` in package.json changes, add a matching block at the
 * TOP of the array below. Newest first — the page renders them in order and
 * does not sort.
 *
 * Write for the salon owner, not for an engineer: say what is different when
 * she uses the app, not which files moved. "Deposit is now editable in
 * Settings" rather than "added DepositSection to settings/page.tsx".
 *
 *   kind: "added"   something she can now do that she couldn't before
 *         "fixed"   something that was broken and now works
 *         "changed" existing behaviour that works differently now
 *         "note"    something she has to do herself for it to take effect
 *
 * Keep each bullet to one line. If a release needs more than about six, it is
 * probably two releases.
 * ─────────────────────────────────────────────────────────────────────────
 */

export type ChangeKind = "added" | "fixed" | "changed" | "note";

export interface ReleaseNote {
  version: string;
  /** ISO date, YYYY-MM-DD. Rendered in Eastern time. */
  date: string;
  changes: { kind: ChangeKind; text: string }[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "1.6.0",
    date: "2026-08-14",
    changes: [
      {
        kind: "changed",
        text: "The service menu now matches what's actually booked: Classic Set ($85), Wispy Set ($100), Hybrid Set ($110), and Lash Lift ($70).",
      },
      {
        kind: "added",
        text: "Lash Lift gets its own section on the booking page — it's not an extension set, so it no longer has to pretend to be one.",
      },
      {
        kind: "note",
        text: "Run supabase/migrations/004_real_service_menu.sql to bring the live database onto the new menu. The old placeholder services are hidden, not deleted, so nothing already booked is affected.",
      },
    ],
  },
  {
    version: "1.5.0",
    date: "2026-08-14",
    changes: [
      {
        kind: "added",
        text: "This page. Every update from now on is listed here, newest first.",
      },
      {
        kind: "added",
        text: "Tap the version at the bottom of any admin page to get back here.",
      },
    ],
  },
  {
    version: "1.4.1",
    date: "2026-08-14",
    changes: [
      {
        kind: "fixed",
        text: "Signature pad follows your finger — strokes were landing well to the left of where you touched on a phone.",
      },
      {
        kind: "fixed",
        text: "Rotating your phone mid-signature keeps what you've drawn instead of wiping it.",
      },
      {
        kind: "fixed",
        text: "Apple Pay and Google Pay now report why they're unavailable instead of failing silently.",
      },
    ],
  },
  {
    version: "1.4.0",
    date: "2026-08-14",
    changes: [
      {
        kind: "added",
        text: "Deposit amount is editable in Settings and applies to every service at once.",
      },
      {
        kind: "added",
        text: "Phone notifications when a new appointment is booked — turn on in Settings.",
      },
      {
        kind: "note",
        text: "Notifications only work after adding the admin to your home screen and opening it from there.",
      },
    ],
  },
  {
    version: "1.3.0",
    date: "2026-08-14",
    changes: [
      {
        kind: "changed",
        text: "New installs start with a $25 deposit. Existing services are untouched — change yours in Settings.",
      },
    ],
  },
  {
    version: "1.2.0",
    date: "2026-08-14",
    changes: [
      {
        kind: "changed",
        text: "The deposit is now required to book. The “I'll bring cash” option is gone.",
      },
      {
        kind: "changed",
        text: "Apple Pay and Google Pay sit above the card form, so nobody has to type a card number.",
      },
      {
        kind: "changed",
        text: "The remaining balance can still be paid by cash or card at the appointment.",
      },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-08-14",
    changes: [
      {
        kind: "fixed",
        text: "Home page nav links sit at the right edge instead of floating mid-row.",
      },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-08-12",
    changes: [
      {
        kind: "added",
        text: "Confirmation screen shows a full appointment receipt: name, lash set, date, time, deposit, studio and artist.",
      },
      {
        kind: "fixed",
        text: "Bookings, Clients, Services, Agreements and Settings now read live data — they were showing sample data.",
      },
      {
        kind: "fixed",
        text: "A card charge that failed to save a booking is now refunded automatically instead of keeping the money.",
      },
      {
        kind: "fixed",
        text: "Customers can no longer change the deposit amount before paying it.",
      },
      {
        kind: "added",
        text: "Signed agreements open with the client's signature and can be printed or saved as PDF.",
      },
      {
        kind: "changed",
        text: "Admin rebuilt for iPhone, the shop and cart archived, and the VIS mark used for the home-screen icon.",
      },
    ],
  },
];
