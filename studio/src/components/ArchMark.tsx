import { useId } from 'react';

// The scalloped Mughal arch from the studio's website, filled in rouge, with a
// chikankari flower and a running stitch that follows the arch, like the
// embroidered border of a Lucknowi kurta.
const ARCH = 'M0 150V58A15 15 0 0 1 5 35A12.5 12.5 0 0 1 16 18A12 12 0 0 1 32 8A11.5 11.5 0 0 1 50 3A11.5 11.5 0 0 1 68 8A12 12 0 0 1 84 18A12.5 12.5 0 0 1 95 35A15 15 0 0 1 100 58V150Z';
const PETAL = 'M0 0c-3-6-2-10 0-12 2 2 3 6 0 12z';

export function ArchMark({ width = 120, monogram = false, className }: { width?: number; monogram?: boolean; className?: string }) {
  const id = useId();
  return (
    <svg className={className} width={width} height={width * 1.5} viewBox="0 0 100 150" role="img" aria-label="Namita Garg Makeover">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="var(--hero-from)" />
          <stop offset="1" stopColor="var(--hero-to)" />
        </linearGradient>
      </defs>
      <path d={ARCH} fill={`url(#${id}g)`} />
      {/* The stitch: the same arch, a little smaller. */}
      <path d={ARCH} fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.4" strokeDasharray="3.2 2.6"
        strokeLinecap="round" transform="translate(50 79) scale(0.86 0.9) translate(-50 -79)" vectorEffect="non-scaling-stroke" />
      <g transform={`translate(50 ${monogram ? 48 : 70}) scale(${monogram ? 1.5 : 2.1})`} fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round">
        {[0, 72, 144, 216, 288].map((r) => <path key={r} d={PETAL} transform={`rotate(${r})`} />)}
        <circle r="1.6" fill="#fff" stroke="none" />
      </g>
      {monogram && (
        <text x="50" y="112" textAnchor="middle" fill="#fff" fontFamily="'Baloo 2 Variable', Mukta, sans-serif"
          fontWeight="700" fontSize="30" letterSpacing="1">NG</text>
      )}
    </svg>
  );
}
