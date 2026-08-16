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
    version: "1.13.0",
    date: "2026-08-16",
    changes: [
      {
        kind: "added",
        text: "Each service can have its own photo on the booking page. Set it in Services — there's a Photo box with a preview so you can see it before saving.",
      },
      {
        kind: "note",
        text: "Run supabase/migrations/009_service_photos.sql in Supabase, or the Photo box won't save.",
      },
      {
        kind: "note",
        text: "The four lash photos need adding to the site first — until a service has a photo set, its card shows the plain tan block it always has.",
      },
    ],
  },
  {
    version: "1.12.3",
    date: "2026-08-16",
    changes: [
      {
        kind: "changed",
        text: "Your intro and the \"How to Book\" steps are there as soon as the home page opens. They used to wait until you scrolled to them and then take several seconds to fade in, leaving a blank gap.",
      },
    ],
  },
  {
    version: "1.12.2",
    date: "2026-08-16",
    changes: [
      {
        kind: "fixed",
        text: "The three photo panels lower down the home page — Connection, Passion and Chemistry — now have their photos ready before you reach them, instead of sitting empty while they loaded.",
      },
    ],
  },
  {
    version: "1.12.1",
    date: "2026-08-16",
    changes: [
      {
        kind: "fixed",
        text: "Switching tabs at the bottom of the app is quick again — the last update made it lag.",
      },
    ],
  },
  {
    version: "1.12.0",
    date: "2026-08-16",
    changes: [
      {
        kind: "added",
        text: "A real calendar — month, week and day. Tap any date to give it its own hours, close it, or block part of it.",
      },
      {
        kind: "added",
        text: "You can now block just part of a day, like 1pm to 3pm for an appointment of your own, instead of losing the whole day.",
      },
      {
        kind: "added",
        text: "Closing a day that already has someone booked is refused, and it shows you who — so a paid client can never be quietly stranded.",
      },
      {
        kind: "added",
        text: "Pull down to refresh, or tap the arrow at the top. It also refreshes on its own when you come back to the app, so new bookings appear without closing and reopening it.",
      },
      {
        kind: "added",
        text: "With no signal the calendar shows your last saved copy instead of an error, clearly labelled.",
      },
      {
        kind: "note",
        text: "Run supabase/migrations/008_date_overrides.sql in Supabase. Section 2 has a query to run first. Until it's done the calendar works but per-date hours won't save.",
      },
    ],
  },
  {
    version: "1.11.2",
    date: "2026-08-16",
    changes: [
      {
        kind: "fixed",
        text: "Settings now shows which Google account your calendar is connected to, under the word \"Connected\". It was never able to show it before.",
      },
      {
        kind: "note",
        text: "Press Disconnect and connect again once, so it can read the address. Your appointments already on the calendar stay where they are.",
      },
    ],
  },
  {
    version: "1.11.1",
    date: "2026-08-16",
    changes: [
      {
        kind: "fixed",
        text: "A stray space copied along with the Google keys no longer breaks the calendar connection — they're trimmed before use.",
      },
      {
        kind: "changed",
        text: "If a Google key is wrong, Settings now tells you which one and why, instead of sending you to a Google error page that never mentions us.",
      },
    ],
  },
  {
    version: "1.11.0",
    date: "2026-08-15",
    changes: [
      {
        kind: "added",
        text: "Tap any appointment — on the dashboard or in Bookings — for its own page, with her number and email tappable, her intake answers, and everything you can do with it.",
      },
      {
        kind: "added",
        text: "Reschedule an appointment. Only times that fit your hours and buffer are offered, and your Google Calendar moves with it.",
      },
      {
        kind: "added",
        text: "Cancelling now emails the client, clears it off your calendar, and lets you note why for your own records.",
      },
      {
        kind: "added",
        text: "\"Next 7 Days\" on the dashboard — the week at a glance from your phone, including which days are free.",
      },
      {
        kind: "added",
        text: "The 24-hour reminder email actually sends now. It never has until today, despite customers being told to expect one.",
      },
      {
        kind: "fixed",
        text: "After 8pm, \"Today's Bookings\" was showing tomorrow's appointments.",
      },
      {
        kind: "note",
        text: "Run supabase/migrations/007_reminders_and_cancellation.sql — reminders can't send until it's there. 004 is still waiting too, for the real Classic/Wispy/Hybrid menu.",
      },
    ],
  },
  {
    version: "1.10.1",
    date: "2026-08-15",
    changes: [
      {
        kind: "fixed",
        text: "Editing a service on your phone closed the keyboard after every single letter. Fixed in every pop-up with a form in it, including the agreement customers sign when they book.",
      },
      {
        kind: "fixed",
        text: "The on/off switch on Services slides across properly — the white dot used to jump outside the switch instead of sliding along it.",
      },
      {
        kind: "fixed",
        text: "Text no longer jumps to a larger size when you turn your phone sideways.",
      },
      {
        kind: "fixed",
        text: "Tapping a button on iPhone no longer flashes a grey square over it, and dropdowns match the rest of the buttons instead of using Safari's own styling.",
      },
    ],
  },
  {
    version: "1.10.0",
    date: "2026-08-15",
    changes: [
      {
        kind: "added",
        text: "Google Calendar. Connect it in Settings and every new appointment appears on your calendar by itself — including on your phone.",
      },
      {
        kind: "added",
        text: "Cancelling an appointment here takes it off your calendar too, so a slot you've freed up doesn't stay blocked.",
      },
      {
        kind: "note",
        text: "Run supabase/migrations/006_google_calendar.sql in Supabase before connecting, or the Connect button won't be able to save anything.",
      },
      {
        kind: "note",
        text: "Connecting also needs a Google key added to the site. Until it's there, Settings honestly says \"Not set up yet\" rather than offering a button that can't work.",
      },
    ],
  },
  {
    version: "1.9.2",
    date: "2026-08-15",
    changes: [
      {
        kind: "fixed",
        text: "Services, Payments, Settings and What's New are reachable on your phone — tap \"More\" in the bottom bar. They only opened on a computer before.",
      },
    ],
  },
  {
    version: "1.9.1",
    date: "2026-08-15",
    changes: [
      {
        kind: "changed",
        text: "The space above your intro on the home page is a little wider again.",
      },
    ],
  },
  {
    version: "1.9.0",
    date: "2026-08-15",
    changes: [
      {
        kind: "added",
        text: "A Payments tab. If a card is ever charged without the booking saving, it's listed there with the Square reference so you can refund her or book her in.",
      },
      {
        kind: "added",
        text: "The dashboard warns you when a payment needs reviewing, so it can't sit unnoticed until you go looking.",
      },
      {
        kind: "added",
        text: "Apple Pay is verified for www.vislashes.com — the domain check Apple requires is done and passing.",
      },
      {
        kind: "note",
        text: "Apple Pay stays hidden on the site until Square is switched from test mode to your real account.",
      },
      {
        kind: "note",
        text: "Phone notifications still need three keys (VAPID) added in Vercel before any alert can actually send.",
      },
    ],
  },
  {
    version: "1.8.2",
    date: "2026-08-15",
    changes: [
      {
        kind: "changed",
        text: "More breathing room on the home page between the opening photo and your intro — they were sitting almost on top of each other on a computer screen.",
      },
    ],
  },
  {
    version: "1.8.1",
    date: "2026-08-15",
    changes: [
      {
        kind: "fixed",
        text: "Your photo and the three \"How to Book\" photos now show on the home page — those four spots were a plain tan block before.",
      },
      {
        kind: "fixed",
        text: "Your portrait had the GPS location of your home studio saved inside the photo file. That was removed before the photo went on the live site.",
      },
    ],
  },
  {
    version: "1.8.0",
    date: "2026-08-15",
    changes: [
      {
        kind: "added",
        text: "Two new sections on the home page from the Figma design: your intro with your photo, and a three-step \"How to Book\".",
      },
      {
        kind: "note",
        text: "Four photos still need exporting from Figma into public/images — until then those spots show a soft tan block rather than a broken image.",
      },
    ],
  },
  {
    version: "1.7.0",
    date: "2026-08-14",
    changes: [
      {
        kind: "added",
        text: "Reorder services with the arrows on each row — that's the order clients see when booking.",
      },
      {
        kind: "added",
        text: "Delete a service you no longer offer. Anything that's been booked can't be deleted, so switch it off instead and its appointments stay intact.",
      },
    ],
  },
  {
    version: "1.6.1",
    date: "2026-08-14",
    changes: [
      {
        kind: "fixed",
        text: "The logo in the header showed as a broken image instead of the wordmark.",
      },
    ],
  },
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
