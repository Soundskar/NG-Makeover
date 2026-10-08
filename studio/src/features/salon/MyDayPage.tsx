import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMe } from '../../auth/auth';
import { Empty, Loaded, Money, Page, TopBar } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { formatDate, todayIST } from '../../lib/dates';
import { summarizeDay, useVisits } from './data';
import { VisitCard, withinCancelWindow } from './VisitCard';

/** Staff: what I logged today. */
export default function MyDayPage() {
  const me = useMe();
  const { t, lang } = useI18n();
  const today = todayIST();
  const visits = useVisits(today);

  return (
    <>
      <TopBar title={t('my_day_title')} />
      <Page>
        <p className="muted">{formatDate(today, lang)}</p>
        <Loaded q={visits}>
          {(all) => {
            const mine = all.filter((v) => v.created_by === me.id);
            const s = summarizeDay(mine);
            return (
              <>
                <div className="stat-grid">
                  <div className="card">
                    <div className="stat-label">{t('total')}</div>
                    <Money n={s.total} className="stat-value" />
                  </div>
                  <div className="card">
                    <div className="stat-label">{t('my_day_entries')}</div>
                    <div className="stat-value num">{s.count}</div>
                  </div>
                </div>
                {mine.length === 0 ? (
                  <Empty title={t('my_day_empty')} sub={t('my_day_empty_sub')} />
                ) : (
                  <div className="stack">
                    <p className="muted small">{t('entry_cancel_window')}</p>
                    {mine.map((v) => (
                      <VisitCard key={v.id} v={v} canCancel={withinCancelWindow(v.created_at)} />
                    ))}
                  </div>
                )}
              </>
            );
          }}
        </Loaded>
        <Link to="/salon/new" className="btn btn-primary btn-lg btn-block"><Plus /> {t('nav_new_entry')}</Link>
      </Page>
    </>
  );
}
