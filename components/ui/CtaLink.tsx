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

export const CTA_HEIGHT = "h-[52px]";

const base =
  `inline-flex items-center justify-center ${CTA_HEIGHT} box-border font-sans font-semibold ` +
  "text-[15px] sm:text-[17px] px-6 sm:px-[39px] rounded-control " +
  "transition-[background-color,color,transform] duration-200 hover:scale-[1.03] active:scale-[0.98] " +
  "motion-reduce:transition-none motion-reduce:hover:scale-100";

const variants = {
  solid: "bg-brand-brown text-white border-2 border-transparent hover:bg-text-brown",
  outline:
    "bg-transparent border-2 border-brand-brown text-brand-tan hover:bg-brand-brown hover:text-white",
  onImage:
    "bg-transparent border-2 border-[#ebebeb] text-white hover:bg-white/20",
} as const;

export function CtaLink({
  href,
  variant = "solid",
  className = "",
  children,
}: {
  href: string;
  variant?: keyof typeof variants;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}
