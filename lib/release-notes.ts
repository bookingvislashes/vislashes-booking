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
    version: "1.33.0",
    date: "2026-09-06",
    changes: [
      {
        kind: "added",
        text: "The booking calendar now grays out every day a client can't actually book — days you're closed, days you've blocked off, and days already full. Those days can't be tapped at all.",
      },
      {
        kind: "changed",
        text: "Days that do have openings are in bold, so a client can see where to tap without opening each day one at a time.",
      },
      {
        kind: "changed",
        text: "Days too soon to book under your advance-notice setting are grayed out too, instead of looking open and then showing no times.",
      },
      {
        kind: "changed",
        text: "The calendar takes the chosen set and a removal into account, so a day with room for only a short appointment grays out for a longer one.",
      },
    ],
  },
  {
    version: "1.32.0",
    date: "2026-09-06",
    changes: [
      {
        kind: "added",
        text: "New Today tab: shows everyone booked today, what they still owe, and a Record payment button for Zelle, Apple Cash, cash or Venmo. One tap tells the site what came in.",
      },
      {
        kind: "added",
        text: "Card payments you take in the Square app — tap, dip, or a reader — now show up on the site automatically, tip included. Nothing new to do in Square itself.",
      },
      {
        kind: "added",
        text: "Reports now shows Collected and Tips for any period, plus a Tips list naming who tipped, how, and how much. The full appointment list and the tax spreadsheet both include a Tip column. Tips are counted by the day the money came in, so one that lands right at a tax-year boundary lands in the right year.",
      },
      {
        kind: "added",
        text: "Older tips from Square's own records are being pulled in now, so tax-season totals aren't limited to tips collected from today forward.",
      },
    ],
  },
  {
    version: "1.31.0",
    date: "2026-09-06",
    changes: [
      { kind: "added", text: "The How to Book photos now lift off the page and straighten slightly when someone points at them, like picking a photo up off a table." },
      { kind: "added", text: "The round photos in Find Your Signature Set ease in a little when someone hovers over that set." },
      { kind: "added", text: "The photo at the top of the home page settles very slowly when the page opens, so it feels alive rather than pasted on." },
      { kind: "fixed", text: "Buttons across the site were meant to grow slightly when you point at them, but the effect was jumping instantly instead of easing. It is smooth now." },
      { kind: "fixed", text: "The email box under Stay Lashed In now shows a soft ring when you click into it, so it is obvious where you are typing." },
    ],
  },
  {
    version: "1.30.3",
    date: "2026-09-06",
    changes: [
      { kind: "changed", text: "The bar at the top of the home page is black now, and Book Appointment is back in it next to Home and Contact." },
      { kind: "added", text: "Your About section has its Meet Vianney heading back — it was missing, so the section started straight into the paragraph." },
      { kind: "changed", text: "Your About paragraph and two of the How to Book steps now read the way they do in the design." },
      { kind: "added", text: "Follow us on social media for the latest news! sits above the social icons again." },
    ],
  },
  {
    version: "1.30.2",
    date: "2026-09-06",
    changes: [
      {
        kind: "fixed",
        text: "The photo at the top of the home page was coming out washed out and cropped in too close. It now shows the way it was designed — the lashes are sharp again and you can see more of her face.",
      },
    ],
  },
  {
    version: "1.30.1",
    date: "2026-09-06",
    changes: [
      {
        kind: "fixed",
        text: "Closed a hole that let someone book a slot without paying. The old pay-at-the-appointment form was removed a while back, but the permission it needed was left switched on — so a person who knew where to look could put a fake confirmed appointment on your calendar with no card charged. Booking through the site is unchanged.",
      },
    ],
  },
  {
    version: "1.30.0",
    date: "2026-09-06",
    changes: [
      {
        kind: "changed",
        text: "Your home page now opens with a full-width photo and your headline sitting right over it, instead of a smaller image off to the side.",
      },
      {
        kind: "changed",
        text: "The How to Book steps now show as tilted photo cards, like they're scattered on a table. They're the same photos as before — if you upload your own in Settings, those still take their place.",
      },
      {
        kind: "changed",
        text: "Classic, Wispy, and Hybrid now show as round photos with the price right next to the name, still pulled straight from your Services list.",
      },
    ],
  },
  {
    version: "1.29.0",
    date: "2026-09-06",
    changes: [
      {
        kind: "changed",
        text: "Nothing to do — the database change behind the new reminders is already applied for you.",
      },
      {
        kind: "changed",
        text: "Reminders now go out two days before the appointment instead of one, which is what you had on Acuity. The email also reads properly now — \"Saturday, September 12\" instead of 2026-09-12.",
      },
      {
        kind: "note",
        text: "The two-hours-before reminder is built and waiting, but it can only send if the site checks more than once a day, and your current Vercel plan allows one check a day. Tell me and I'll set up a free hourly checker, or upgrading Vercel to Pro also does it.",
      },
      {
        kind: "note",
        text: "These reminders are email. Text messages need a paid texting service and a registered number — say the word and I'll walk you through what it costs and set it up.",
      },
      {
        kind: "fixed",
        text: "If the email service was down, reminders used to be marked as sent anyway and were never retried — so nobody got one and nothing showed it. They're now retried on the next check.",
      },
    ],
  },
  {
    version: "1.28.0",
    date: "2026-09-06",
    changes: [
      {
        kind: "changed",
        text: "Nothing to do — the database change behind Invoices is already applied for you.",
      },
      {
        kind: "added",
        text: "There's a Reports tab. Pick Day, Week, Month or Year and step through with the arrows to see how many appointments you did, what they were worth, and how many different clients you saw. Year opens into a month-by-month table, and Download for taxes gives you a spreadsheet of every appointment in the period — 2023 onward is all in there.",
      },
      {
        kind: "added",
        text: "There's an Invoices tab. Make an invoice for a deposit, copy the link, and text it to your client — she opens it, pays by card, and it flips to Paid on your screen. Picking the appointment fills in the deposit and the wording for you, and if someone pays you cash you can mark it paid yourself.",
      },
      {
        kind: "added",
        text: "The top of the Invoices tab shows what you're still owed and what you've collected, and the Not paid filter is the first thing you see.",
      },
    ],
  },
  {
    version: "1.27.0",
    date: "2026-09-06",
    changes: [
      {
        kind: "changed",
        text: "Every client's visit count is real now. All 563 appointments from your Acuity schedule, 2023 through 2026, were loaded in and matched to the right person, so the Clients list shows how many times someone has actually sat in your chair and when they last came in — not the placeholder 1 everyone was stuck on after the import.",
      },
      {
        kind: "changed",
        text: "Clients you have in your list but who never had an appointment on the schedule now show 0 visits instead of 1, so \"returning client\" means something you can trust.",
      },
      {
        kind: "added",
        text: "Your full appointment history is stored on the site now, which is what the reports for tax season will be built on. Nothing about it shows to clients.",
      },
    ],
  },
  {
    version: "1.26.0",
    date: "2026-09-06",
    changes: [
      {
        kind: "changed",
        text: "Rewrote your home page intro in your words — leads with your years of experience, speaks straight to someone booking their first lash appointment, and explains that every set is planned around their own eye shape rather than copy-pasted.",
      },
      {
        kind: "changed",
        text: "Classic, Wispy, and Hybrid now describe what each set actually looks like — a natural mascara look, feathery strip-lash look, and a fuller volume look that isn't heavy — instead of the older, vaguer wording.",
      },
    ],
  },
  {
    version: "1.25.1",
    date: "2026-08-30",
    changes: [
      {
        kind: "changed",
        text: "Widened the service-selection step so the four full sets have real room to breathe instead of looking pushed together. Every step after it keeps its narrower, form-friendly width.",
      },
      {
        kind: "changed",
        text: "Prices on the service cards now show as whole dollars ($85) instead of with cents ($85.00) — nothing you sell needs the extra digits.",
      },
    ],
  },
  {
    version: "1.25.0",
    date: "2026-08-30",
    changes: [
      {
        kind: "changed",
        text: "Redesigned how refills work on the booking page. Instead of grayed-out cards you had to tap to find out why they wouldn't respond, there's now a plain \"Need a refill?\" question — the same size as the page's main heading — with the explanation right underneath and a phone number box. The moment a returning client's number matches, that box fades away and her refills appear in its place, ready to book.",
      },
      {
        kind: "changed",
        text: "Classic, Wispy, Hybrid, and Lash Lift now sit in one row instead of three-plus-one on tablet and desktop. On a phone they still stack one at a time, full-width and easy to read — most of her clients book from their phone.",
      },
    ],
  },
  {
    version: "1.24.2",
    date: "2026-08-30",
    changes: [
      {
        kind: "note",
        text: "Found and fixed the real cause of the missing time slots and missing refills: the database column your service photos were supposed to live in (image_url) had never actually been created, so every real menu lookup was silently failing and falling back to old placeholder data with fake IDs — which is also why the calendar showed no times on any date, even ones you'd marked open. I applied the missing database changes directly (migrations 008, 009, and 010, which had only partly run). No further action needed from you — verified live that your Classic, Wispy, Hybrid, Lash Lift, and all three refills now load with real data, and a real date now returns real times.",
      },
      {
        kind: "changed",
        text: "Refill service cards now say directly that they're for returning clients whose lashes were applied here, instead of that only living in a small note above the section.",
      },
      {
        kind: "changed",
        text: "Shortened the Classic, Wispy, Hybrid, and Lash Lift descriptions on the booking page to one clear sentence each, so nothing gets cut off mid-thought on the card.",
      },
      {
        kind: "changed",
        text: "Removed the last name from the Facebook reviewer's testimonial — shown by first name only now, like the others.",
      },
      {
        kind: "note",
        text: "Also removed a leftover archived service (Premium Wispy Glam) and its two cancelled test bookings — this was requested earlier but never finished.",
      },
    ],
  },
  {
    version: "1.24.1",
    date: "2026-08-27",
    changes: [
      {
        kind: "changed",
        text: "Reviews no longer say which app or site they came from — just the client's name.",
      },
    ],
  },
  {
    version: "1.24.0",
    date: "2026-08-27",
    changes: [
      {
        kind: "changed",
        text: "\"What Clients Say\" is redesigned. Each review now sits on its own line with the client's name beside it, set larger and in the same font as your headings, instead of four small boxes. The short ones no longer look like something failed to load.",
      },
    ],
  },
  {
    version: "1.23.0",
    date: "2026-08-27",
    changes: [
      {
        kind: "changed",
        text: "The top of the home page matches the new design: your headline sits on the left with the photo beside it, rather than the words sitting on top of the photo.",
      },
    ],
  },
  {
    version: "1.22.0",
    date: "2026-08-27",
    changes: [
      {
        kind: "changed",
        text: "Trimmed the wording across the home page — your intro, How to Book, and the Signature Sets — so it reads at a glance instead of asking someone to stop and read a paragraph. No facts changed, just fewer words between them.",
      },
    ],
  },
  {
    version: "1.21.0",
    date: "2026-08-27",
    changes: [
      {
        kind: "added",
        text: "Settings now has a \"How to Book Photos\" section — upload your own photo for each of the three How to Book steps on the home page, right from your phone. Leave a step alone to keep its current photo.",
      },
      {
        kind: "added",
        text: "Added a \"What Clients Say\" section to the home page with real client messages and reviews.",
      },
    ],
  },
  {
    version: "1.20.0",
    date: "2026-08-27",
    changes: [
      {
        kind: "note",
        text: "Fixed a serious bug: your booking site has been showing every visitor a hardcoded demo menu instead of your real services, because anonymous visitors were never actually allowed to read the services table — only your logged-in admin session was. That's why the calendar showed no time slots on any day, and it likely means no real payment could complete since at least August 14th. Run the new migration (Migrations page, or the SQL in supabase/migrations/011_public_read_grants.sql) right away to fix it — this is the single most important thing in this update.",
      },
      {
        kind: "added",
        text: "Tapping \"Book [Set Name]\" on the home page now takes you straight into the booking flow with that set already chosen and the calendar open — no need to pick it again.",
      },
      {
        kind: "changed",
        text: "Service cards on the home page now show the plain price instead of \"Starting at $X\".",
      },
      {
        kind: "changed",
        text: "Footer social icons now link to your real Instagram, Facebook, and TikTok. Removed the placeholder Behance and Twitter icons, which never went anywhere.",
      },
    ],
  },
  {
    version: "1.19.0",
    date: "2026-08-27",
    changes: [
      {
        kind: "changed",
        text: "The three home page banners that used to say \"Connection / Passion / Chemistry\" (leftover from selling lash products) now show your actual Classic, Wispy, and Hybrid sets — real name, real starting price, and a Book button for that set. Same photos, layout stays as-is; edit a set's price in Services and the home page picks it up within a minute.",
      },
    ],
  },
  {
    version: "1.18.0",
    date: "2026-08-20",
    changes: [
      {
        kind: "added",
        text: "Deleting a service that still has appointments on it now shows you exactly who and when, right in Services — and, if they're only tests, deletes them along with the service. No more asking for a SQL script.",
      },
      {
        kind: "added",
        text: "New Migrations page (in the sidebar, or under More on your phone) runs database updates with a tap instead of pasting SQL into Supabase.",
      },
      {
        kind: "note",
        text: "The Migrations page needs a database connection to work — add SUPABASE_DB_URL in Vercel (Supabase dashboard → Project Settings → Database → Connection string → URI) and redeploy. Until then it'll tell you it's not connected.",
      },
    ],
  },
  {
    version: "1.17.0",
    date: "2026-08-20",
    changes: [
      {
        kind: "changed",
        text: "Switched-off services move into a collapsed \"Archived\" list under your live ones, so old placeholders stop cluttering the page.",
      },
      {
        kind: "fixed",
        text: "When a service can't be deleted, it now names the appointment blocking it and what to do — instead of just refusing.",
      },
    ],
  },
  {
    version: "1.16.1",
    date: "2026-08-20",
    changes: [
      {
        kind: "fixed",
        text: "The client import said rows were \"skipped for having no name, email or phone\" even when the real problem was something else entirely. It now shows what actually went wrong.",
      },
    ],
  },
  {
    version: "1.16.0",
    date: "2026-08-20",
    changes: [
      {
        kind: "added",
        text: "Refills are back, at your Acuity prices. They sit locked for new clients — tapping one explains you don't refill another tech's work and points them to a full set instead.",
      },
      {
        kind: "added",
        text: "Returning clients unlock refills themselves by entering the phone number they booked with. Email works too.",
      },
      {
        kind: "added",
        text: "Lash removal, $25, addable to any set. It adds 30 minutes to the appointment, so the calendar blocks the right amount of time automatically.",
      },
      {
        kind: "added",
        text: "Photos on the service cards. Add one per service in Services, then slide it until only the eyes show.",
      },
      {
        kind: "added",
        text: "Import your Acuity client list from Clients. Running it twice updates people instead of duplicating them.",
      },
      {
        kind: "changed",
        text: "Lash Lift now sits with the full sets instead of under its own heading.",
      },
      {
        kind: "note",
        text: "Run supabase/migrations/010_refills_removal_import.sql — refills, removals and the client import all need it.",
      },
    ],
  },
  {
    version: "1.15.0",
    date: "2026-08-16",
    changes: [
      {
        kind: "added",
        text: "A menu button on the website when it's viewed on a phone — Home, About, How to Book, Contact, your Instagram, and a Book Appointment button. There was no way to get around the site on a phone before.",
      },
    ],
  },
  {
    version: "1.14.0",
    date: "2026-08-16",
    changes: [
      {
        kind: "added",
        text: "Home page sections now rise gently into place as you scroll down. The photos are already loaded before a section starts moving, so nothing sits blank waiting.",
      },
    ],
  },
  {
    version: "1.13.2",
    date: "2026-08-16",
    changes: [
      {
        kind: "fixed",
        text: "Home page photos appear straight away. They were far larger than they needed to be — all of them together are now about a twentieth of the size, and they no longer wait on anything.",
      },
    ],
  },
  {
    version: "1.13.1",
    date: "2026-08-16",
    changes: [
      {
        kind: "changed",
        text: "The Connection, Passion and Chemistry panels are there the moment the home page opens. Nothing on the home page waits for you to scroll to it any more.",
      },
    ],
  },
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
