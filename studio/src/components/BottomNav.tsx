import { CalendarCheck, ClipboardList, Home, Menu, PlusCircle, Scissors, UserRound, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useMe } from '../auth/auth';
import { useI18n, type TKey } from '../i18n/i18n';

interface Item {
  to: string;
  label: TKey;
  icon: ReactNode;
  end?: boolean;
}

export function BottomNav() {
  const me = useMe();
  const { t } = useI18n();

  let items: Item[];
  if (me.is_owner) {
    items = [
      { to: '/', label: 'nav_home', icon: <Home />, end: true },
      { to: '/students', label: 'nav_students', icon: <Users /> },
      { to: '/salon', label: 'nav_salon', icon: <Scissors /> },
      { to: '/more', label: 'nav_more', icon: <Menu /> },
    ];
  } else {
    items = [];
    if (me.is_staff) {
      items.push({ to: '/salon/new', label: 'nav_new_entry', icon: <PlusCircle /> });
      items.push({ to: '/my-day', label: 'nav_my_day', icon: <ClipboardList /> });
    }
    if (me.is_trainer) {
      items.push({ to: '/classes', label: 'nav_classes', icon: <CalendarCheck /> });
      items.push({ to: '/students', label: 'nav_students', icon: <Users /> });
    }
    items.push({ to: '/account', label: 'nav_me', icon: <UserRound /> });
  }

  return (
    <nav className="bottom-nav" aria-label={t('nav_label')}>
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-pill">{i.icon}</span>
          {t(i.label)}
        </NavLink>
      ))}
    </nav>
  );
}
