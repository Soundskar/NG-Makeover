import { BarChart3, CalendarDays, ChevronRight, Clock, Contact, GraduationCap, HandCoins, HardDriveDownload, History, IndianRupee, ListChecks, PhoneCall, Scissors, Store, UserRound, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Page, TopBar } from '../../components/ui';
import { useI18n, type TKey } from '../../i18n/i18n';

const items: { to: string; label: TKey; sub: TKey; icon: ReactNode }[] = [
  { to: '/fees', label: 'followup_title', sub: 'more_fees_sub', icon: <IndianRupee /> },
  { to: '/classes', label: 'classes_title', sub: 'more_classes_sub', icon: <ListChecks /> },
  { to: '/bookings', label: 'bookings_title', sub: 'more_bookings_sub', icon: <CalendarDays /> },
  { to: '/clients', label: 'clients_title', sub: 'more_clients_sub', icon: <Contact /> },
  { to: '/salon/callback', label: 'callback_title', sub: 'more_callback_sub', icon: <PhoneCall /> },
  { to: '/salon/work', label: 'work_title', sub: 'work_sub', icon: <BarChart3 /> },
  { to: '/salon/udhaar', label: 'udhaar_title', sub: 'more_udhaar_sub', icon: <HandCoins /> },
  { to: '/more/catalog', label: 'catalog_title', sub: 'more_catalog_sub', icon: <Scissors /> },
  { to: '/more/courses', label: 'courses_title', sub: 'more_courses_sub', icon: <GraduationCap /> },
  { to: '/more/team', label: 'team_title', sub: 'more_team_sub', icon: <Users /> },
  { to: '/more/slots', label: 'slots_title', sub: 'more_slots_sub', icon: <Clock /> },
  { to: '/more/studio', label: 'studio_title', sub: 'more_studio_sub', icon: <Store /> },
  { to: '/more/backup', label: 'backup_title', sub: 'more_backup_sub', icon: <HardDriveDownload /> },
  { to: '/more/history', label: 'history_title', sub: 'more_history_sub', icon: <History /> },
  { to: '/account', label: 'account_title', sub: 'more_account_sub', icon: <UserRound /> },
];

export default function MorePage() {
  const { t } = useI18n();
  return (
    <>
      <TopBar title={t('nav_more')} />
      <Page>
        <div className="list">
          {items.map((i) => (
            <Link key={i.to} to={i.to} className="list-item">
              <span className="avatar" style={{ borderRadius: 12 }}>{i.icon}</span>
              <span className="grow">
                <span className="title" style={{ display: 'block' }}>{t(i.label)}</span>
                <span className="sub">{t(i.sub)}</span>
              </span>
              <ChevronRight className="chev" />
            </Link>
          ))}
        </div>
      </Page>
    </>
  );
}
