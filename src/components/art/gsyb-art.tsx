/**
 * Original artwork for the Gujarat State Yog Board portal.
 * Every graphic here is hand-authored SVG inside this repository —
 * no third-party images, no licensing concerns, crisp at any DPI.
 *
 * Visual language: sunrise disc, meditation silhouette, lotus petals,
 * and a subtle "toran"-inspired petal band. Colors derive from the
 * global brand tokens (maroon / saffron gold) with warm-paper tints.
 */

type ArtProps = { className?: string; style?: React.CSSProperties };

/** Warm-paper sunrise gradient used behind hero art. */
export function SunriseField({ className, style }: ArtProps) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 800 600"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      preserveAspectRatio="xMidYMax slice"
    >
      <defs>
        <linearGradient id="gsyb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--brand-accent)" stopOpacity="0.16" />
          <stop offset="0.55" stopColor="var(--brand-accent)" stopOpacity="0.07" />
          <stop offset="1" stopColor="var(--brand-primary)" stopOpacity="0.10" />
        </linearGradient>
        <linearGradient id="gsyb-disc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--brand-accent)" />
          <stop offset="1" stopColor="var(--brand-accent)" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#gsyb-sky)" />
      {/* sun disc + halo rings */}
      <circle cx="400" cy="392" r="150" fill="url(#gsyb-disc)" opacity="0.22" />
      <circle cx="400" cy="392" r="112" fill="url(#gsyb-disc)" opacity="0.30" />
      <circle cx="400" cy="392" r="78" fill="url(#gsyb-disc)" opacity="0.85" />
      {/* thin horizon arcs */}
      <path d="M60 470 Q400 428 740 470" stroke="var(--brand-primary)" strokeOpacity="0.14" strokeWidth="2" />
      <path d="M110 505 Q400 468 690 505" stroke="var(--brand-primary)" strokeOpacity="0.10" strokeWidth="2" />
      <path d="M170 540 Q400 508 630 540" stroke="var(--brand-primary)" strokeOpacity="0.07" strokeWidth="2" />
    </svg>
  );
}

/** Seated meditation silhouette (padmasana, hands in dhyana mudra). */
export function MeditationSilhouette({ className, style }: ArtProps) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 320 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g fill="var(--brand-primary)">
        {/* head */}
        <circle cx="160" cy="66" r="26" />
        {/* neck + torso */}
        <path d="M150 88 h20 l6 22 c10 8 16 22 16 38 l-4 56 h-56 l-4 -56 c0 -16 6 -30 16 -38 z" />
        {/* crossed legs / lotus base */}
        <path d="M160 198 c-52 0 -96 14 -96 30 c0 12 30 20 96 20 c66 0 96 -8 96 -20 c0 -16 -44 -30 -96 -30 z" />
        {/* left arm resting to knee */}
        <path d="M124 118 c-16 10 -34 30 -42 56 l10 8 c14 -18 30 -36 44 -46 z" />
        {/* right arm resting to knee */}
        <path d="M196 118 c16 10 34 30 42 56 l-10 8 c-14 -18 -30 -36 -44 -46 z" />
      </g>
      {/* dhyana mudra hands */}
      <circle cx="86" cy="184" r="7" fill="var(--brand-primary)" opacity="0.85" />
      <circle cx="234" cy="184" r="7" fill="var(--brand-primary)" opacity="0.85" />
    </svg>
  );
}

/** Standing tree-pose silhouette (vrikshasana). */
export function TreePoseSilhouette({ className, style }: ArtProps) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 200 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g fill="var(--brand-primary)">
        <circle cx="100" cy="40" r="20" />
        <path d="M92 58 h16 l4 14 c8 6 12 16 12 28 l-2 44 h-44 l-2 -44 c0 -12 4 -22 12 -28 z" />
        {/* arms raised overhead */}
        <path d="M92 70 c-14 -6 -30 -20 -38 -40 l8 -6 c10 14 22 26 34 32 z" />
        <path d="M108 70 c14 -6 30 -20 38 -40 l-8 -6 c-10 14 -22 26 -34 32 z" />
        {/* standing leg */}
        <path d="M94 144 h12 l4 96 h-20 z" />
        {/* folded leg */}
        <path d="M106 152 c14 -4 26 -14 32 -28 l-10 -6 c-6 10 -14 18 -24 22 z" />
      </g>
    </svg>
  );
}

/** Line-art lotus (eight petals) — section dividers and accents. */
export function LotusMark({ className, style }: ArtProps) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 120 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g stroke="var(--brand-primary)" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round">
        <path d="M60 56 C60 40 60 24 60 8" />
        <path d="M60 56 C50 42 36 30 20 24 C30 40 44 50 60 56 z" />
        <path d="M60 56 C70 42 84 30 100 24 C90 40 76 50 60 56 z" />
        <path d="M60 56 C48 48 30 44 12 44 C26 52 44 56 60 56 z" />
        <path d="M60 56 C72 48 90 44 108 44 C94 52 76 56 60 56 z" />
      </g>
      <circle cx="60" cy="12" r="4" fill="var(--brand-accent)" />
    </svg>
  );
}

/** Small solid lotus used as a bullet / badge glyph. */
export function LotusBadge({ className, style }: ArtProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3 c1.8 2.4 2.7 4.6 2.7 6.6 0 2.3 -1.2 4.2 -2.7 4.2 s-2.7 -1.9 -2.7 -4.2 c0 -2 0.9 -4.2 2.7 -6.6 z" fill="var(--brand-primary)" />
      <path d="M4 8 c3.2 0.9 5.6 2.4 7 4.5 1.4 2.2 1.3 4.8 -0.2 5.8 -1.5 1 -3.9 0 -5.3 -2.2 C4.2 14 3.6 11.3 4 8 z" fill="var(--brand-primary)" opacity="0.75" />
      <path d="M20 8 c-3.2 0.9 -5.6 2.4 -7 4.5 -1.4 2.2 -1.3 4.8 0.2 5.8 1.5 1 3.9 0 5.3 -2.2 1.3 -2.1 1.9 -4.8 1.5 -8.1 z" fill="var(--brand-primary)" opacity="0.75" />
      <path d="M6.5 14.5 c2.1 0.6 3.9 1.9 5.5 4 -2.6 0.3 -5 -0.6 -6.7 -2.4 -0.9 -1 -1.2 -1.7 -1.2 -1.7 z" fill="var(--brand-accent)" />
      <path d="M17.5 14.5 c-2.1 0.6 -3.9 1.9 -5.5 4 2.6 0.3 5 -0.6 6.7 -2.4 0.9 -1 1.2 -1.7 1.2 -1.7 z" fill="var(--brand-accent)" />
    </svg>
  );
}

/**
 * Subtle repeating petal band ("toran" inspired). Used as a hairline
 * separator between homepage sections. Pure CSS-friendly data URI.
 */
export const petalBandStyle: React.CSSProperties = {
  height: "10px",
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='10' viewBox='0 0 36 10'%3E%3Cpath d='M0 10 Q9 0 18 10 Q27 0 36 10' fill='none' stroke='%239F3138' stroke-opacity='0.28' stroke-width='1.4'/%3E%3C/svg%3E\")",
  backgroundRepeat: "repeat-x",
};

/** Radial sun-ray crown for the inspirational quote band. */
export function SunRayCrown({ className, style }: ArtProps) {
  const rays = Array.from({ length: 24 }, (_, i) => i * 15);
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 400 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g transform="translate(200 200)">
        {rays.map((a) => (
          <line
            key={a}
            x1="0"
            y1="-70"
            x2="0"
            y2={a % 45 === 0 ? "-118" : "-96"}
            stroke="var(--brand-accent)"
            strokeOpacity={a % 45 === 0 ? 0.7 : 0.35}
            strokeWidth={a % 45 === 0 ? 2.4 : 1.4}
            transform={`rotate(${a})`}
            strokeLinecap="round"
          />
        ))}
        <circle r="52" fill="var(--brand-accent)" opacity="0.16" />
      </g>
    </svg>
  );
}

/** Wide community-yoga scene: three silhouettes (elder, adult, child). */
export function CommunityYogaScene({ className, style }: ArtProps) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 900 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      preserveAspectRatio="xMidYMax meet"
    >
      {/* ground line */}
      <path d="M40 214 H860" stroke="var(--brand-primary)" strokeOpacity="0.16" strokeWidth="2" strokeLinecap="round" />
      {/* --- seated elder (left) --- */}
      <g fill="var(--brand-primary)" opacity="0.85" transform="translate(120 60) scale(0.92)">
        <circle cx="60" cy="30" r="22" />
        <path d="M51 48 h18 l5 18 c8 7 13 18 13 31 l-3 40 h-48 l-3 -40 c0 -13 5 -24 13 -31 z" />
        <path d="M60 130 c-40 0 -72 10 -72 22 c0 10 24 16 72 16 c48 0 72 -6 72 -16 c0 -12 -32 -22 -72 -22 z" />
        <path d="M32 66 c-12 8 -25 22 -31 41 l8 6 c10 -13 21 -26 31 -34 z" />
        <path d="M88 66 c12 8 25 22 31 41 l-8 6 c-10 -13 -21 -26 -31 -34 z" />
      </g>
      {/* --- standing adult (center, tree pose) --- */}
      <g fill="var(--brand-primary)" transform="translate(390 14) scale(0.98)">
        <circle cx="70" cy="24" r="19" />
        <path d="M62 40 h16 l4 13 c7 5 11 14 11 25 l-2 40 h-42 l-2 -40 c0 -11 4 -20 11 -25 z" />
        <path d="M62 50 c-12 -5 -26 -17 -33 -35 l7 -5 c9 12 19 22 29 28 z" />
        <path d="M78 50 c12 -5 26 -17 33 -35 l-7 -5 c-9 12 -19 22 -29 28 z" />
        <path d="M64 118 h12 l3 88 h-18 z" />
        <path d="M76 126 c13 -4 23 -12 29 -25 l-9 -5 c-5 9 -12 16 -21 19 z" />
      </g>
      {/* --- seated child (right) --- */}
      <g fill="var(--brand-primary)" opacity="0.85" transform="translate(650 96) scale(0.72)">
        <circle cx="60" cy="30" r="20" />
        <path d="M52 46 h16 l5 16 c7 6 12 16 12 28 l-3 36 h-44 l-3 -36 c0 -12 5 -22 12 -28 z" />
        <path d="M60 122 c-36 0 -64 9 -64 20 c0 9 22 15 64 15 c42 0 64 -6 64 -15 c0 -11 -28 -20 -64 -20 z" />
        <path d="M34 62 c-11 7 -22 19 -27 36 l7 5 c9 -11 18 -22 27 -30 z" />
        <path d="M86 62 c11 7 22 19 27 36 l-7 5 c-9 -11 -18 -22 -27 -30 z" />
      </g>
    </svg>
  );
}

/** Soft organic blob frame for portrait imagery / illustration cards. */
export function PetalFrame({
  className,
  style,
  children,
}: ArtProps & { children?: React.ReactNode }) {
  return (
    <div className={className} style={{ position: "relative", ...style }}>
      <svg
        viewBox="0 0 400 320"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        preserveAspectRatio="none"
      >
        <path
          d="M28 160 C28 66 118 18 200 18 C282 18 372 66 372 160 C372 254 282 302 200 302 C118 302 28 254 28 160 z"
          fill="var(--brand-accent)"
          fillOpacity="0.12"
        />
      </svg>
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}
