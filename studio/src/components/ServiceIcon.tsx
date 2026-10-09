import type { ReactNode } from 'react';

// Small line drawings for the salon menu, one per kind of service, drawn on a
// 24px grid in the same weight as the app's other icons. The icon is chosen
// from the English service (or category) name, so new services pick one up
// without anyone having to set it.

const FACE = <path d="M12 3c3.6 0 6 2.8 6 7 0 4.6-3 10-6 10s-6-5.4-6-10c0-4.2 2.4-7 6-7z" />;

const ICONS: Record<string, ReactNode> = {
  brow: <>
    <path d="M3.5 9.5c3.5-3.4 9-4.4 13.5-2.4" />
    <path d="M5 15c2.6-2.8 7.4-2.8 10 0-2.6 2.8-7.4 2.8-10 0z" /><circle cx="10" cy="15" r="1.2" />
    <path d="M20 3c-.8 6-.8 12 0 18" />
  </>,
  faceThread: <>{FACE}<path d="M8.5 9c1-.8 2-.8 3 0M12.5 9c1-.8 2-.8 3 0" /><path d="M21 3c-.6 6-.6 12 0 18" /></>,
  faceWax: <>{FACE}<rect x="13" y="11.5" width="9" height="4" rx="1" transform="rotate(-25 17.5 13.5)" /></>,
  underarm: <><circle cx="10" cy="5" r="2" /><path d="M7 21v-7.5a3 3 0 0 1 6 0V21" /><path d="M13 11l3.5-3L18 3" /></>,
  arm: <><path d="M2 13.5h11.5l3.2-3.2a1.4 1.4 0 0 1 2 2l-1.7 1.7h3a1.5 1.5 0 0 1 0 3h-5c-.8 0-1.4.5-2 1H2" /><rect x="4.5" y="12" width="4" height="7" rx=".8" /></>,
  leg: <><path d="M8 2v11c0 2-.5 4-.5 6v1.5c0 .8.7 1.5 1.5 1.5h8a1.5 1.5 0 0 0 0-3h-4.5c0-2 .5-4 .5-6V2" /><rect x="6" y="6" width="9" height="3.5" rx=".8" /></>,
  body: <><circle cx="12" cy="4.5" r="2" /><path d="M12 7v7M7.5 10h9M12 14l-3 7M12 14l3 7" /></>,
  cleanup: <>{FACE}<circle cx="19" cy="4.5" r="1.6" /><circle cx="21" cy="8.5" r="1" /><circle cx="16.5" cy="2" r=".8" /></>,
  facial: <>{FACE}<path d="M9 9.5h.01M15 9.5h.01" /><path d="M19.5 1.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" /></>,
  drop: <><path d="M12 3c3 4 6 7.4 6 11a6 6 0 0 1-12 0c0-3.6 3-7 6-11z" /><path d="M9.5 15a2.6 2.6 0 0 0 2.5 2.5" /></>,
  gem: <><path d="M7 4h10l4 5-9 11L3 9z" /><path d="M3 9h18M10 4l2 16 2-16" /></>,
  scissors: <><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12" /></>,
  dryer: <><path d="M13 4H8a4 4 0 0 0 0 8h5l7-2V6z" /><path d="M9 12l1 8h3l-1-8" /><circle cx="8" cy="8" r="1.2" /></>,
  iron: <><path d="M7 3h3l1 12-2 6-2-6z" /><path d="M13 3h3l-1 12-2 6" /><path d="M10 9h3" /></>,
  comb: <><rect x="3" y="7" width="18" height="4" rx="1" /><path d="M5 11v6M8 11v6M11 11v6M14 11v6M17 11v6M19.5 11v4" /></>,
  oil: <><path d="M8.5 10h7v9a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2z" /><path d="M10 10V7h4v3M11 7V3h2v4" /><path d="M12 13.5c1 1.2 1.5 2 1.5 2.7a1.5 1.5 0 0 1-3 0c0-.7.5-1.5 1.5-2.7z" /></>,
  spa: <><path d="M3 12h18a9 9 0 0 1-18 0z" /><path d="M9 3c-1 2 1 3 0 5M14 3c-1 2 1 3 0 5" /></>,
  jar: <><rect x="5" y="9" width="14" height="12" rx="2.5" /><path d="M7 9V6h10v3" /><path d="M9 14h6" /></>,
  hand: <><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V10M14 10.5V6a1.5 1.5 0 0 1 3 0v7.5c0 4-2.8 7.5-6.5 7.5-2.8 0-4.6-1.7-5.7-4.2L3.5 13.6A1.5 1.5 0 0 1 6 12.2L8 14" /></>,
  foot: <><path d="M9 21c-2.2 0-3.5-1.8-3.5-4 0-2.8 2-4 2-7 0-2.2 1.2-4 3.2-4s3.3 1.8 3.3 4c0 2.8-1.2 4.6-.2 6.8.8 1.8-.8 4.2-4.8 4.2z" /><circle cx="15.5" cy="4.5" r="1.2" /><circle cx="17.8" cy="6.5" r="1" /><circle cx="19" cy="9.2" r=".9" /></>,
  lipstick: <><path d="M9 21h6v-9H9z" /><path d="M10 12V7.5L14 4v8" /><path d="M8 21h8" /></>,
  tikka: <><path d="M4 4c5 3 11 3 16 0" /><path d="M12 5v4" /><path d="M12 9c2 2.5 3 4 3 5.5a3 3 0 0 1-6 0c0-1.5 1-3 3-5.5z" /><circle cx="12" cy="20.5" r=".9" /></>,
  ring: <><circle cx="12" cy="15" r="6" /><path d="M9.5 6.5L12 3.5l2.5 3L12 9z" /></>,
  gift: <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v8h14v-8M12 8v12" /><path d="M12 8c-1.6-3.6-5.5-3.8-5.5-1.5S9.7 8 12 8zM12 8c1.6-3.6 5.5-3.8 5.5-1.5S14.3 8 12 8z" /></>,
  calendarHeart: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /><path d="M12 18.5l-2.6-2.4a1.6 1.6 0 1 1 2.6-1.9 1.6 1.6 0 1 1 2.6 1.9z" /></>,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
};

export type ServiceIconName = keyof typeof ICONS;

/** Which drawing fits a service or category, from its English name. */
export function iconFor(name: string): ServiceIconName {
  const n = name.toLowerCase();
  if (n.includes('full face thread')) return 'faceThread';
  if (n.includes('thread')) return 'brow';
  if (n.includes('wax')) {
    if (n.includes('face')) return 'faceWax';
    if (n.includes('underarm')) return 'underarm';
    if (n.includes('arm')) return 'arm';
    if (n.includes('leg')) return 'leg';
    return 'body';
  }
  if (n.includes('cleanup')) return 'cleanup';
  if (n.includes('hydra')) return 'drop';
  if (/diamond|gold|pearl/.test(n) && n.includes('facial')) return 'gem';
  if (n.includes('facial')) return 'facial';
  if (n.includes('straighten')) return 'iron';
  if (n.includes('dryer')) return 'dryer';
  if (n.includes('styling')) return 'comb';
  if (/condition|oil/.test(n)) return 'oil';
  if (n.includes('spa')) return 'spa';
  if (/cut|trim|hair/.test(n)) return 'scissors';
  if (n.includes('bleach')) return 'jar';
  if (n.includes('manicure') || n.includes('mani')) return 'hand';
  if (n.includes('pedicure')) return 'foot';
  if (n.includes('pre-bridal')) return 'calendarHeart';
  if (n.includes('package')) return 'gift';
  if (n.includes('bridal')) return 'tikka';
  if (n.includes('engagement')) return 'ring';
  if (n.includes('party') || n.includes('makeup')) return 'lipstick';
  return 'facial';
}

export function ServiceIcon({ name, size = 24 }: { name: ServiceIconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}
