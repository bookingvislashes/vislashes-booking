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
 * The three photos are the illustrative ones from the Figma frame, generated
 * rather than photographed. They are deliberately generic — a tray of lashes,
 * a phone, a treatment room — and the alt text describes what is in frame
 * without claiming any of it is this studio, because none of it is. Anything
 * that has to be true of the real studio (its address, the artist, prices)
 * still comes from the database. If a real photo of the room is wanted here,
 * it goes in through Settings, which overrides these.
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
    body:
      "Select a lash profile tailored to your eye shape and desired fullness, from classic to volume.",
    image: "/images/howtobook-choose.webp",
    alt: "Trays of lash extensions laid out on a linen table",
  },
  {
    number: "2",
    title: "Book & Deposit",
    body: "A $25 deposit secures your private session with your lash artist.",
    image: "/images/howtobook-deposit.webp",
    alt: "A hand holding a phone with a booking calendar open",
  },
  {
    number: "3",
    title: "Confirm & Arrive",
    body:
      "Review your appointment details, studio address, and pre-care tips before your private session.",
    image: "/images/howtobook-arrive.webp",
    alt: "A treatment room set up for a lash appointment",
  },
] as const;
