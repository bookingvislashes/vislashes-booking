import Link from "next/link";

/**
 * Marketing call-to-action link.
 *
 * Height is set explicitly rather than derived from padding + line-height, so a
 * solid and an outlined CTA sitting next to each other are always the same
 * height. Borders are included in that height (border-box), which is what the
 * hand-rolled versions got wrong — the outlined hero button rendered 4px taller
 * than the solid one because its 2px border stacked on top of equal padding.
 */

export const CTA_HEIGHT = "h-control-lg";

// Tailwind v4 compiles scale-* to the standalone `scale` property, not to
// `transform`. This transitioned `transform` for a long time, which meant the
// hover and press scales snapped rather than eased.
const base =
  "inline-flex items-center justify-center box-border " +
  "rounded-control border-2 " +
  "transition-[background-color,color,scale] duration-200 hover:scale-[1.03] active:scale-[0.98] " +
  "motion-reduce:transition-none motion-reduce:hover:scale-100";

const sizes = {
  /* Matches the 40px header row rather than the 52px marketing height — the
     header CTA sits beside 24px icons, not beside other CTAs. */
  sm: "h-[40px] text-[14px] sm:text-[15px] px-4 sm:px-5",
  lg: `${CTA_HEIGHT} text-[15px] sm:text-[17px] px-6 sm:px-[39px]`,
} as const;

const variants = {
  solid: "bg-brand-brown text-white border-transparent hover:bg-text-brown",
  /* Was `text-brand-tan`, which is 2.5:1 on the cream page background — below
     AA at any size. `text-text-brown` is 5.2:1 and is the same pairing the
     `secondary` Button variant already uses, so the outlined link and the
     outlined button finally match. */
  outline:
    "bg-transparent border-brand-brown text-text-brown hover:bg-brand-brown hover:text-white",
  onImage: "bg-transparent border-[#ebebeb] text-white hover:bg-white/20",
  dark: "bg-charcoal text-white border-transparent hover:bg-dark-brown",
  /* The hero's primary CTA, which sits on the darkened photograph. `dark`
     was used there and put charcoal on a brown scrim — the button read as a
     hole in the image rather than the thing to press. Cream on charcoal is
     13:1 and is the lightest surface already in the palette, so it is the
     highest-contrast button available without introducing a new colour. */
  light: "bg-cream text-charcoal border-transparent hover:bg-white",
  outlineDark:
    "bg-transparent border-charcoal text-charcoal hover:bg-charcoal hover:text-white",
  /* Figma's "Primary, light mode" button — the Signature Set row CTAs.
     Charcoal on this tan is 6.6:1, and 5.1:1 on the brand-tan hover, so the
     label clears AA in both states. */
  tan: "bg-cta-tan text-charcoal border-transparent hover:bg-brand-tan",
} as const;

// The font classes are composed alongside `base` rather than substituted into
// it: a string replace would fail silently if `base` were ever reworded, and
// nothing would surface that until someone noticed the buttons looked wrong.
// Swaps the sans/semibold weight for the display italic used by the
// Signature Set row CTAs — kept as a prop rather than a new variant because
// it is independent of color (variant), not tied to it.
const fonts = {
  sans: "font-sans font-semibold",
  display: "font-display font-bold italic",
} as const;

export function CtaLink({
  href,
  variant = "solid",
  size = "lg",
  font = "sans",
  className = "",
  children,
}: {
  href: string;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  font?: keyof typeof fonts;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`${base} ${fonts[font]} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
