// The scalloped Mughal arch from the studio's website, in black (white in the
// evening), with the chikankari flower in pink.
const ARCH = 'M0 150V58A15 15 0 0 1 5 35A12.5 12.5 0 0 1 16 18A12 12 0 0 1 32 8A11.5 11.5 0 0 1 50 3A11.5 11.5 0 0 1 68 8A12 12 0 0 1 84 18A12.5 12.5 0 0 1 95 35A15 15 0 0 1 100 58V150Z';
const PETAL = 'M0 0c-4.5-3-5-9 0-12 5 3 4.5 9 0 12z';

export function ArchMark({ width = 120, monogram = false, className }: { width?: number; monogram?: boolean; className?: string }) {
  return (
    <svg className={className} width={width} height={width * 1.5} viewBox="0 0 100 150" role="img" aria-label="Namita Garg Makeover">
      <path d={ARCH} fill="var(--mark)" />
      <g transform={`translate(50 ${monogram ? 50 : 72}) scale(${monogram ? 1.6 : 2.2})`} fill="var(--accent)">
        {[0, 72, 144, 216, 288].map((r) => <path key={r} d={PETAL} transform={`rotate(${r})`} />)}
        <circle r="2" />
      </g>
      {monogram && (
        <text x="50" y="114" textAnchor="middle" fill="var(--on-mark)" fontFamily="'Inter Tight Variable', Mukta, sans-serif"
          fontWeight="800" fontSize="32" letterSpacing="-1">NG</text>
      )}
    </svg>
  );
}
