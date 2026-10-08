import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckRow, ErrorBox, Field, Loaded, Money, MoneyInput, Page, TopBar, useToast } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { formatDate, todayIST } from '../../lib/dates';
import { formatINR, sum } from '../../lib/money';
import { must, supabase } from '../../lib/supabase';
import { summarizeDay, useClosing, useVisits } from './data';
import { diffText } from './SalonDayPage';

/** Owner: count the drawer and compare with what was logged. */
export default function CloseDayPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const day = params.get('day') ?? todayIST();
  const visits = useVisits(day);
  const closing = useClosing(day);
  const academyCash = useQuery({
    queryKey: ['academy-cash', day],
    queryFn: async () => sum((must(await supabase.from('payments').select('amount')
      .eq('paid_on', day).eq('mode', 'cash').eq('voided', false)) as { amount: number }[]).map((p) => p.amount)),
  });

  const [counted, setCounted] = useState<number | null>(null);
  const [upiOk, setUpiOk] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => {
    if (closing.data) {
      setCounted(closing.data.counted_cash);
      setUpiOk(closing.data.upi_checked);
      setNote(closing.data.note ?? '');
    }
  }, [closing.data]);

  const save = useMutation({
    mutationFn: async () => must(await supabase.rpc('close_day', {
      p_day: day, p_counted_cash: counted ?? 0, p_upi_checked: upiOk, p_note: note,
    })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['closing'] });
      toast({ kind: 'success', text: t('close_saved') });
      navigate(day === todayIST() ? '/salon' : `/salon?day=${day}`);
    },
  });

  return (
    <>
      <TopBar title={t('close_title')} back />
      <Page>
        <p className="muted">{formatDate(day, lang)}</p>
        <Loaded q={visits}>
          {(all) => {
            const s = summarizeDay(all);
            const diff = counted == null ? null : counted - s.cash;
            return (
              <>
                <div className="card stack" style={{ gap: 4 }}>
                  <div className="stat-label">{t('close_expected')}</div>
                  <Money n={s.cash} className="stat-value" />
                  <div className="stat-sub">{t('close_expected_sub', { n: s.count })}</div>
                </div>

                <Field label={t('close_counted')} htmlFor="cc">
                  <MoneyInput id="cc" value={counted} onChange={setCounted} autoFocus={!closing.data} />
                </Field>

                {diff != null && (
                  <div key={diff === 0 ? 'match' : 'off'} className={`notice ${diff === 0 ? 'notice-success' : 'notice-warning'}`}
                    style={{ fontSize: '1.125rem', fontWeight: 700, animation: 'fade-in 0.2s' }}>
                    {diff === 0 ? <CheckCircle2 /> : <AlertTriangle />}
                    {diffText(diff, t)}
                  </div>
                )}

                <div className="card stack">
                  <div className="row-between">
                    <span className="stat-label">{t('close_upi_expected')}</span>
                    <Money n={s.upi} className="title" />
                  </div>
                  <CheckRow checked={upiOk} onChange={setUpiOk} label={t('close_upi_check')} />
                </div>

                {(academyCash.data ?? 0) > 0 && (
                  <div className="notice notice-info">{t('close_academy_cash', { amount: formatINR(academyCash.data!) })}</div>
                )}

                <Field label={`${t('note')} (${t('optional')})`} htmlFor="cn">
                  <textarea id="cn" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} />
                </Field>

                {save.error && <ErrorBox error={save.error} />}
                <button className="btn btn-primary btn-lg btn-block" disabled={counted == null || save.isPending} aria-busy={save.isPending} onClick={() => save.mutate()}>
                  <Lock /> {closing.data ? t('close_update') : t('close_title')}
                </button>
              </>
            );
          }}
        </Loaded>
      </Page>
    </>
  );
}
