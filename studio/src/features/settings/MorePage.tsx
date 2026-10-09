import { BarChart3, CalendarDays, ChevronRight, Clock, Contact, GraduationCap, HandCoins, HardDriveDownload, History, IndianRupee, ListChecks, PhoneCall, Scissors, Store, UserRound, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Page, TopBar } from '../../components/ui';
import { useI18n, type TKey } from '../../i18n/i18n';

interface Item { to: string; label: TKey; sub?: TKey; icon: ReactNode }

// Daily tools first; settings that are opened once in a while after them.
// Only settings get a sub-line, where the name alone may not say enough.
const groups: { title: TKey; items: Item[] }[] = [
  {
    title: 'more_daily',
    items: [
      { to: '/fees', label: 'followup_title', icon: <IndianRupee /> },
      { to: '/classes', label: 'classes_title', icon: <ListChecks /> },
      { to: '/bookings', label: 'bookings_title', icon: <CalendarDays /> },
      { to: '/clients', label: 'clients_title', icon: <Contact /> },
      { to: '/salon/callback', label: 'callback_title', icon: <PhoneCall /> },
      { to: '/salon/udhaar', label: 'udhaar_title', icon: <HandCoins /> },
      { to: '/salon/work', label: 'work_title', icon: <BarChart3 /> },
    ],
  },
  {
    title: 'more_setup',
    items: [
      { to: '/more/catalog', label: 'catalog_title', sub: 'more_catalog_sub', icon: <Scissors /> },
      { to: '/more/courses', label: 'courses_title', sub: 'more_courses_sub', icon: <GraduationCap /> },
      { to: '/more/team', label: 'team_title', sub: 'more_team_sub', icon: <Users /> },
      { to: '/more/slots', label: 'slots_title', sub: 'more_slots_sub', icon: <Clock /> },
      { to: '/more/studio', label: 'studio_title', sub: 'more_studio_sub', icon: <Store /> },
    ],
  },
  {
    title: 'more_records',
    items: [
      { to: '/more/backup', label: 'backup_title', sub: 'more_backup_sub', icon: <HardDriveDownload /> },
      { to: '/more/history', label: 'history_title', sub: 'more_history_sub', icon: <History /> },
      { to: '/account', label: 'account_title', sub: 'more_account_sub', icon: <UserRound /> },
    ],
  },
];

export default function MorePage() {
  const { t } = useI18n();
  return (
    <>
      <TopBar title={t('nav_more')} />
      <Page>
        {groups.map((g) => (
          <section key={g.title} className="stack" style={{ gap: 8 }}>
            <h2 className="section-title">{t(g.title)}</h2>
            <div className="list">
              {g.items.map((i) => (
                <Link key={i.to} to={i.to} className="list-item">
                  <span className="row-icon">{i.icon}</span>
                  <span className="grow">
                    <span className="title" style={{ display: 'block' }}>{t(i.label)}</span>
                    {i.sub && <span className="sub">{t(i.sub)}</span>}
                  </span>
                  <ChevronRight className="chev" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </Page>
    </>
  );
}
