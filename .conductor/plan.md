# Homepage → Figma sync — task plan

Worktree: /Users/graphicaljerry/Documents/GitHub/vislashes-figma-sync
Branch: design/homepage-figma-sync (off origin/main @ c538261)
NO PUSH STEP. `main` is production (vislashes.com).

Baseline confirmed green: tsc clean, lint 9 problems (7 err / 2 warn), build exit 0.
NOTE: repo CLAUDE.md says lint baseline is "9 errors / 4 warnings" — the real
number is 9 problems total (7 errors, 2 warnings). Hold to the real number.

## User decisions already made
- Build ALL THREE sections.
- How to Book: polaroid LAYOUT, existing REAL photos (/images/howtobook-*.webp).
  Do NOT ship the AI-generated images.
- Service area wording "St Cloud and Lake Nona" was confirmed by the user
  earlier in the session. Hero subtext keeps it.

## Token map (workers cannot see Figma)
cream #F7F3EE · dark-brown #3D2B1F · text-brown #805F45 · brand-tan #B4957C
charcoal #2E2A27/#1e1d1c · muted #635D5A · light-tan #E0D6CC · card-beige #D8CBBF
Container: max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-[120px]
Radii: rounded-surface (8px) / rounded-control (3px). Tailwind v4 arbitrary values.
font-display = Playfair Display (brand, keep). Two font families only.

## Verify gate for EVERY task (run in the worktree)
npx tsc --noEmit          # clean
npm run lint              # must not exceed 9 problems (7 err / 2 warn)
npm run build             # must compile
Visual: npm run dev, screenshot 375x812 / 768x1024 / 1440x900 and INSPECT.

---

TASK 1 — Hero portrait asset · Tier: standard · Depends: none
Files: public/images/hero-portrait.webp (new only)
Source: Figma node 739:299 export (fileKey x40EhVLvaRXuxZH2tPzENt, node 739:298).
Use sharp v0.34.5 via a one-off node script in the scratchpad: flatten on white,
resize width 1440 (~1440x1916), webp quality 78, effort 6. Output <= 200KB;
step quality to >=70 before dropping width to 1280.
Do NOT modify or delete hero-photo.webp or any other image.
Verify: sips -g pixelWidth -g pixelHeight -g hasAlpha public/images/hero-portrait.webp
        && stat -f%z public/images/hero-portrait.webp   (1440 wide, no alpha, <=204800)

TASK 2 — How to Book: floating polaroids · Tier: hard · Depends: none
Files: components/home/HowToBook.tsx (rewrite). Do NOT change STEPS values.
Keep props contract exactly: HowToBook({ photoOverrides }), src = override || step.image,
imageReady = Boolean(override) || hasAsset(step.image), unoptimized={!override},
loading="eager", alt from step.alt. STEPS keys stay "1"|"2"|"3" (settings-table keys);
display numerals derived: step.number.padStart(2,"0") -> 01/02/03, aria-hidden.
Header: H2 36/48/52px font-display font-bold text-charcoal max-w-[782px]; new intro p:
"Three steps from choosing your set to walking into the studio — everything private,
nothing rushed." font-sans text-muted text-[16px] leading-[1.6] max-w-[570px].
Card: bg-white rounded-[4px] p-[20px] pb-[32px] gap-[20px] w-[340px]
      shadow-[0_12px_12px_rgba(61,43,31,0.10)]; photo aspect-square object-cover.
      numeral font-display font-bold italic text-brand-tan 22px; title font-display
      font-bold text-dark-brown 18px; body font-sans text-muted 14px leading-[1.5].
Card 2 at 1.15x: w-[391px] p-[23px] pb-[37px] gap-[23px], 25/21/15px.
lg collage: relative w-full max-w-[1176px] mx-auto h-[541px]; absolute cards
      P1 left 8% top 70px rotate-[7deg] z-10 · P2 left 33.5% top 0 rotate-[-5deg] z-20
      · P3 left 67.8% top 115px rotate-[4deg] z-10. transform-gpu. DOM order 1,2,3.
Below lg: flex-col items-center gap-8, each w-full max-w-[340px] (card 2 too),
      rotate -2/+2/-2deg, NO overlap. Section overflow-x-clip, keeps px-6.
Update top comment to cite node 785:247 and why numbering is derived.
Out of scope: app/page.tsx, how-to-book-steps.ts values, admin/HowToBookPhotos.tsx, images.
Verify: gate + 1440 screenshot shows 3 tilted polaroids (+7/-5/+4), middle largest and
on top, all three REAL photos rendered (not tan boxes), italic tan 01/02/03; 768 & 375
stacked, no overlap, scrollWidth === innerWidth, captions legible.

TASK 3 — Signature Sets V4 + CtaLink variants + intro copy · Tier: standard · Depends: none
Files: app/page.tsx (Signature Set block + sectionVisuals only), components/ui/CtaLink.tsx
CtaLink: add variants dark ("bg-charcoal text-white border-transparent hover:bg-dark-brown")
and outlineDark ("bg-transparent border-charcoal text-charcoal hover:bg-charcoal
hover:text-white"); add prop font?: "sans" | "display" (default "sans") swapping
font-sans font-semibold for font-display font-bold italic. Base/sizes/CTA_HEIGHT
unchanged so existing call sites render identically.
page.tsx: KEEP getFeaturedServices, fallbackFeaturedServices, formatPrice, leadSentence,
getHowToBookPhotos, revalidate=60, PRODUCTS_ENABLED block, Reveal delay={index*80}.
Never hardcode a service name/price/description into JSX. CTA stays /book?service=${id}.
Slim sectionVisuals to { imageSrc, imagePosition }[]; SAME image order
(connection -> passion -> chemistry); positions LEFT / RIGHT / LEFT. Drop gradient,
imageWidth, imageEdgeOffset, flipImage (no scaleX(-1)).
Header: centred max-w-[720px] gap 16px; H2 36/44/48px leading-[1.15]; intro p EXACTLY:
"Three full sets, each one applied by me, one client at a time. Not sure which is yours?
Book the closest fit — we'll settle the final look together at your appointment."
Rows: max-w-[960px] mx-auto; lg flex items-center justify-between py-[48px].
Circle: relative shrink-0 rounded-full overflow-hidden bg-card-beige size-[320px],
Image fill object-cover object-top, eager, unoptimized, alt={section.name}.
Info col w-[480px] gap-[16px]: numeral (aria-hidden, font-display bold italic
text-text-brown 24px) -> title/price row (flex items-baseline justify-between;
name font-display bold text-charcoal 36px; price font-display bold text-muted 24px)
-> description font-sans text-muted 15px leading-[1.6] -> CTA pt-[8px]
<CtaLink variant="outlineDark" size="sm" font="display">Book {name}</CtaLink>.
md 768-1023: same rows, circle 240px, info flex-1, py-8.
Below md: flex-col items-center gap-6, circle 240px, info max-w-[420px], text-left,
40px between rows, px-6.
Remove the full-bleed gradient panels entirely.
Verify: gate + grep -c 'service=\${' app/page.tsx == 1; no hardcoded set names outside
fallback; 1440 screenshot shows 3 alternating 320px circles on beige, italic tan
01/02/03, price right-aligned on title line, outlined italic Book buttons; click ->
/book?service=<id>; 375 circle above text no overflow; 'quiet poetry' absent.

TASK 4 — Hero: Concept C full-bleed toned portrait · Tier: hard · Depends: 1, 3
Files: components/home/ParallaxHero.tsx (rewrite; keep filename + export name)
Remove "use client", the rAF parallax, and ALL mix-blend-difference / z-index
stacking-context code. Becomes a server component. Rewrite the doc comment:
node 739:298, why the blend is gone, filename is historical.
Section full-bleed relative overflow-hidden bg-white.
Heights: lg h-[clamp(720px,calc(100svh-102px),1024px)];
below lg h-[clamp(560px,calc(100svh-86px),760px)].
Layers: (1) Image src="/images/hero-portrait.webp" alt="Close-up of a client's finished
wispy lash set" fill priority unoptimized sizes="100vw"
className="object-cover object-[65%_35%] lg:object-[60%_40%]";
(2) tone overlay absolute inset-0 bg-text-brown/[0.36] aria-hidden;
(3) scrim aria-hidden: lg bg-gradient-to-r from-dark-brown/85 from-[0%]
via-dark-brown/60 via-[40%] to-transparent to-[80%] (via pushed 24.5%->40% for
contrast over the 440px subtext column — comment this);
below lg bg-gradient-to-t from-dark-brown/85 via-dark-brown/55 via-[45%]
to-transparent to-[75%].
Text: standard container, relative z-10 h-full flex flex-col justify-end pb-12
lg:justify-center lg:pb-0. H1 "Your lash appointment, without the salon."
font-display bold text-cream 40/52/64px leading-[1.04] max-w-[500px].
mt-6 p: "Every set is done one-on-one in Vianney's private home studio near Lake Nona
and St. Cloud — no walk-ins, no other chairs, no rush." font-sans text-light-tan
16/17px leading-[1.45] max-w-[440px].
mt-8 CTA: <CtaLink href={PRODUCTS_ENABLED ? "#products" : "/book"} variant="dark">
{PRODUCTS_ENABLED ? "Shop Our Collection" : "Book Appointment"}</CtaLink> — keep the
PRODUCTS_ENABLED fallback AND its existing explanatory comment. Site CTA height, not
Figma's 68px. animate-fade-in-up on H1, subtext delay 120ms, CTA 240ms.
Keep priority + unoptimized (LCP). No second/mobile asset.
Overlays aria-hidden. H1 is the page's only h1. Contrast >= 4.5:1 at 1440 and 375;
if subtext fails, darken the via stop to /65 rather than shrinking text.
Verify: gate + ! grep mix-blend + ! grep '"use client"' + grep hero-portrait.webp;
1440 screenshot: edge-to-edge toned portrait, face right, dark->transparent left scrim,
cream 64px headline, charcoal Book Appointment button, all inside first viewport;
375: photo fills, text/button bottom-left over bottom-up scrim, eye visible above
headline, no horizontal overflow; button lands on /book.

TASK 5 — Version bump, release note, final QA · Tier: standard · Depends: 2, 3, 4
Files: package.json (version only), lib/release-notes.ts (one new top entry)
version 1.26.0 -> 1.27.0 (minor). New RELEASE_NOTES entry FIRST, version "1.27.0",
date >= 2026-09-06, three kind:"changed" bullets in HER language, no file names:
 - home page opens on a full-width photo with the headline over it
 - How to Book steps are now tilted polaroid photos (same photos; the ones she
   uploads in Settings still replace them)
 - the three sets are shown as round photos with the price beside the name, still
   pulled from her Services list
Full-page pass at 375/768/1440 with Supabase configured: real service names/prices,
real ?service= ids, Settings-uploaded How to Book photo still wins, Founder /
Testimonials / Stay Lashed In visually unchanged, no console errors.
Do NOT fix the lint baseline. Do NOT push.
Verify: release note version === package.json version; gate; 3-breakpoint full-page shots.

---

## Waves
Wave 1 (parallel): TASK 1 · TASK 2 (hard) · TASK 3
Wave 2: TASK 4 (hard) -> TASK 5

File ownership (no overlap):
  page.tsx + CtaLink.tsx -> T3 only
  HowToBook.tsx          -> T2 only
  ParallaxHero.tsx       -> T4 only
  package.json + release-notes.ts -> T5 only
Untouched: Header, FounderIntro, Reveal, how-to-book-steps.ts values, proxy.ts

---

## USER DECISIONS — these OVERRIDE anything above

D1. Hero photo duplication. The Figma hero photo is the same photograph as
    /images/passion-photo.webp, which is the Wispy Set row image. Decision:
    the HERO keeps that photo; the WISPY SET ROW changes to the real service
    photo Vianney uploaded in the admin. Rows 1 (Classic) and 3 (Hybrid) are
    unchanged. This adds an asset to TASK 1 and one line to TASK 3.

    New asset: public/images/wispy-set-photo.webp
    Source: https://rltlwoayrrautwosxgpn.supabase.co/storage/v1/object/public/service-photos/47d24eb0-d105-4a0a-95a8-bde08bf357a3.jpeg
    (711x550, the live Wispy Set service photo). Local copy also at
    /private/tmp/claude-501/-Users-graphicaljerry/892e58c7-6e2b-492f-892e-56d9ff984fbf/scratchpad/svc/wispy-hi.jpg

    Note: this photo is a full rectangular photo, not an alpha cut-out like the
    other two, so it fills its circle rather than letting card-beige show
    through. That is expected and accepted.

D2. Signature Set intro copy — APPROVED exactly as the architect wrote it:
    "Three full sets, each one applied by me, one client at a time. Not sure
    which is yours? Book the closest fit — we'll settle the final look together
    at your appointment."

D3. Hero subtext keeps "near Lake Nona and St. Cloud". The user confirmed that
    service area earlier in this session. No further check needed.

## TOKEN MAP CORRECTION (found by the TASK 2 worker)
The architect's hex annotations were wrong for three tokens. The CODE is fine
because tasks use Tailwind token NAMES, but do not trust these hexes when
reasoning about contrast:
  muted       actual #6E6A63  (plan said #635D5A) — 5.38:1 on white, clears 5:1
  light-tan   actual #E8DDD0  (plan said #E0D6CC) — LIGHTER, so hero subtext
                                                     contrast is better, not worse
  card-beige  actual #E7D7CB  (plan said #D8CBBF)
TASK 4 must measure real contrast on a rendered screenshot, not from these hexes.
