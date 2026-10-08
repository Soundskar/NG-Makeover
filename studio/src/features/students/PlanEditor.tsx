import { Check, Plus, X } from 'lucide-react';
import { MoneyInput } from '../../components/ui';
import { useI18n } from '../../i18n/i18n';
import { addMonths, type ISODate } from '../../lib/dates';
import { formatINR, makePlan, sum } from '../../lib/money';

export interface PlanRow {
  key: number;
  due_date: ISODate;
  amount: number | null;
}

let k = 1;
export const toRows = (plan: { due_date: string; amount: number }[]): PlanRow[] =>
  plan.map((p) => ({ key: k++, due_date: p.due_date, amount: p.amount }));

export function planIsValid(rows: PlanRow[], total: number): boolean {
  return rows.length > 0 && rows.every((r) => r.amount != null && r.amount > 0 && r.due_date)
    && sum(rows.map((r) => r.amount ?? 0)) === total;
}

/** Installment rows (date + amount) with quick presets. Rows must add up to `total`. */
export function PlanEditor({ total, rows, onChange, firstDate }: {
  total: number; rows: PlanRow[]; onChange: (rows: PlanRow[]) => void; firstDate: ISODate;
}) {
  const { t } = useI18n();
  const planSum = sum(rows.map((r) => r.amount ?? 0));
  const preset = (parts: number) => onChange(toRows(makePlan(total, parts, firstDate)));

  return (
    <div className="stack">
      <div className="chips" role="toolbar" aria-label={t('plan')}>
        <button type="button" className="chip" onClick={() => preset(1)}>{t('plan_full')}</button>
        <button type="button" className="chip" onClick={() => preset(2)}>{t('plan_parts', { n: 2 })}</button>
        <button type="button" className="chip" onClick={() => preset(3)}>{t('plan_parts', { n: 3 })}</button>
        <button type="button" className="chip" onClick={() => preset(4)}>{t('plan_parts', { n: 4 })}</button>
      </div>

      <div className="list">
        {rows.map((r, i) => (
          <div key={r.key} className="list-item" style={{ gap: 8 }}>
            <span className="muted num" style={{ width: 20 }}>{i + 1}.</span>
            <input
              type="date"
              className="input"
              style={{ flex: '1 1 0', minWidth: 0, padding: '12px 8px' }}
              aria-label={t('plan_due_date', { n: i + 1 })}
              value={r.due_date}
              onChange={(e) => onChange(rows.map((x) => (x.key === r.key ? { ...x, due_date: e.target.value } : x)))}
            />
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <MoneyInput
                aria-label={t('plan_amount', { n: i + 1 })}
                value={r.amount}
                onChange={(n) => onChange(rows.map((x) => (x.key === r.key ? { ...x, amount: n } : x)))}
              />
            </div>
            <button type="button" className="icon-btn" aria-label={t('remove')} disabled={rows.length === 1}
              onClick={() => onChange(rows.filter((x) => x.key !== r.key))}>
              <X />
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="btn btn-secondary btn-block" onClick={() => {
        const last = rows[rows.length - 1];
        const left = Math.max(0, total - planSum);
        onChange([...rows, { key: k++, due_date: last ? addMonths(last.due_date, 1) : firstDate, amount: left || null }]);
      }}>
        <Plus /> {t('plan_add_row')}
      </button>

      {planSum === total ? (
        <p className="text-success" style={{ fontWeight: 700 }}>
          <Check size={18} style={{ verticalAlign: '-3px' }} /> {t('plan_sum_ok', { amount: formatINR(total) })}
        </p>
      ) : (
        <p className="text-warning" style={{ fontWeight: 700 }}>
          {planSum < total
            ? t('plan_sum_short', { amount: formatINR(total - planSum) })
            : t('plan_sum_over', { amount: formatINR(planSum - total) })}
        </p>
      )}
    </div>
  );
}
