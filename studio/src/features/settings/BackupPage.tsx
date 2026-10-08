import { useMutation, useQueryClient } from '@tanstack/react-query';
import { HardDriveDownload, ShieldCheck } from 'lucide-react';
import { ErrorBox, Loaded, Page, TopBar, useToast } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { formatDateTime, todayIST } from '../../lib/dates';
import { downloadWorkbook } from '../../lib/export';
import { must, supabase } from '../../lib/supabase';
import { useSettings } from '../students/data';

// Every table Mom's business depends on, in a sensible reading order.
const TABLES = [
  'students', 'student_details', 'enrollments', 'enrollment_fees', 'installments', 'payments',
  'attendance', 'module_progress', 'visits', 'visit_lines', 'day_closings',
  'courses', 'course_modules', 'service_categories', 'services', 'time_slots', 'holidays', 'profiles',
] as const;

/** Reads a whole table, 1000 rows at a time (Supabase's page size). */
async function readAll(table: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const rows = must(await supabase.from(table).select('*').range(from, from + 999)) as Record<string, unknown>[];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

export default function BackupPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const settings = useSettings();

  const backup = useMutation({
    mutationFn: async () => {
      const sheets = [];
      for (const name of TABLES) sheets.push({ name, rows: await readAll(name) });
      await downloadWorkbook(`ng-studio-backup-${todayIST()}.xlsx`, sheets);
      must(await supabase.from('settings').update({ last_backup_at: new Date().toISOString() }).eq('id', true));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast({ kind: 'success', text: t('backup_done') });
    },
  });

  return (
    <>
      <TopBar title={t('backup_title')} back="/more" />
      <Page>
        <div className="notice notice-info"><ShieldCheck /><span>{t('backup_explain')}</span></div>
        <Loaded q={settings}>
          {({ settings: s }) => (
            <p className="muted">
              {s.last_backup_at ? t('backup_last', { when: formatDateTime(s.last_backup_at, lang) }) : t('alert_backup_never')}
            </p>
          )}
        </Loaded>
        {backup.error && <ErrorBox error={backup.error} />}
        <button className="btn btn-primary btn-lg btn-block" disabled={backup.isPending} onClick={() => backup.mutate()}>
          <HardDriveDownload /> {backup.isPending ? t('backup_working') : t('backup_now')}
        </button>
        <p className="muted small">{t('backup_where')}</p>
      </Page>
    </>
  );
}
