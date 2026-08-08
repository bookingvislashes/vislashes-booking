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

const base =
  "inline-flex items-center justify-center box-border font-sans font-semibold " +
  "rounded-control border-2 " +
  "transition-[background-color,color,transform] duration-200 hover:scale-[1.03] active:scale-[0.98] " +
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
} as const;

export function CtaLink({
  href,
  variant = "solid",
  size = "lg",
  className = "",
  children,
}: {
  href: string;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
