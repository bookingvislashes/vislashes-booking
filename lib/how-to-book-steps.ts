/**
 * The three steps shown in the home page's "How to Book" section.
 *
 * Kept separate from components/home/HowToBook.tsx because that component
 * imports lib/has-asset.ts, which touches node:fs — fine for a server
 * component, but it means anything that imports HowToBook.tsx pulls fs into
 * its bundle too. The admin's HowToBookPhotos.tsx (a client component) only
 * needs the step numbers and titles, and importing them from here keeps
 * node:fs out of the browser bundle entirely.
 *
 * The deposit figure in step 2 is stated here as $25, matching the services
 * table. It is intentionally NOT read from the database: this is marketing
 * copy on a static page, and a per-service deposit has no single value to
 * quote. If the deposit changes, this line changes with it.
 */
export const STEPS = [
  {
    number: "1",
    title: "Choose Your Look",
    body: "Pick your set, tailored to your eye shape and desired fullness.",
    image: "/images/howtobook-choose.webp",
    alt: "Close-up of finished lash extensions",
  },
  {
    number: "2",
    title: "Book & Deposit",
    body: "A $25 deposit secures your private session with your lash artist.",
    image: "/images/howtobook-deposit.webp",
    alt: "The private lash studio",
  },
  {
    number: "3",
    title: "Confirm & Arrive",
    body: "You'll get appointment details, the address, and pre-care tips by email.",
    image: "/images/howtobook-arrive.webp",
    alt: "Client being prepared for a lash appointment",
  },
] as const;
