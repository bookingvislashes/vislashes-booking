import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full bg-black py-[22px] px-6">
      <div className="max-w-[1440px] mx-auto flex flex-col items-center gap-2">
        <div className="flex items-center justify-center gap-3">
          {/* Instagram Icon */}
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" className="text-instagram">
            <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
          </svg>
          {/* Handle */}
          <Link
            href="https://instagram.com/vislashesbooking"
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans font-medium text-[18px] text-instagram tracking-[0.25px] uppercase hover:text-white transition-colors"
          >
            @vislashesbooking
          </Link>
        </div>
        <p className="font-sans text-[11px] leading-none tracking-[0.4px] text-white/40 tabular-nums">
          {process.env.NEXT_PUBLIC_BUILD_ID}
        </p>
      </div>
    </footer>
  );
}
