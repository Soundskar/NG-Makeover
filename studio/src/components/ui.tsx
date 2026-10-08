import { AlertTriangle, ArrowLeft, Inbox, Search, WifiOff } from 'lucide-react';
import {
  createContext, useCallback, useContext, useEffect, useId, useRef, useState,
  type InputHTMLAttributes, type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { errorText, useI18n } from '../i18n/i18n';
import { formatINR } from '../lib/money';

// ---------- page frame ----------

export function TopBar({ title, back, actions }: { title: string; back?: boolean | string; actions?: ReactNode }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  return (
    <header className="topbar">
      {back && (
        <button
          className="icon-btn"
          aria-label={t('back')}
          onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
        >
          <ArrowLeft />
        </button>
      )}
      <h1>{title}</h1>
      {actions}
    </header>
  );
}

export function Page({ children, className = 'stack-lg' }: { children: ReactNode; className?: string }) {
  return <main className={`page ${className}`}>{children}</main>;
}

export function Spinner() {
  const { t } = useI18n();
  return <div className="spinner" role="status" aria-label={t('loading')} />;
}

export function Empty({ title, sub, icon }: { title: string; sub?: string; icon?: ReactNode }) {
  return (
    <div className="empty">
      {icon ?? <Inbox />}
      <p className="title">{title}</p>
      {sub && <p>{sub}</p>}
    </div>
  );
}

export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="notice notice-danger" role="alert">
      <AlertTriangle />
      <div className="grow stack">
        <span>{errorText(error, t)}</span>
        {retry && (
          <button className="btn btn-secondary btn-sm" onClick={retry}>{t('retry')}</button>
        )}
      </div>
    </div>
  );
}

/** Shows a spinner / error / children depending on a React Query result. */
export function Loaded<T>({ q, children }: {
  q: { data: T | undefined; isPending: boolean; error: unknown; refetch: () => unknown };
  children: (data: T) => ReactNode;
}) {
  if (q.error) return <ErrorBox error={q.error} retry={() => q.refetch()} />;
  if (q.isPending || q.data === undefined) return <Spinner />;
  return <>{children(q.data)}</>;
}

export function OfflineBanner() {
  const { t } = useI18n();
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (online) return null;
  return (
    <div className="offline-banner" role="alert">
      <WifiOff size={18} style={{ verticalAlign: '-3px', marginRight: 8 }} />
      {t('offline')}
    </div>
  );
}

// ---------- form pieces ----------

export function Field({ label, hint, error, children, htmlFor }: {
  label: string; hint?: string; error?: string | null; children: ReactNode; htmlFor?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <p className="error">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

const groupINR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** Rupee amount input with Indian digit grouping and the number keypad. */
export function MoneyInput({ value, onChange, id, autoFocus, invalid, placeholder, ...rest }: {
  value: number | null;
  onChange: (n: number | null) => void;
  id?: string;
  autoFocus?: boolean;
  invalid?: boolean;
  placeholder?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <div className="money-input">
      <span className="rupee" aria-hidden="true">₹</span>
      <input
        {...rest}
        id={id}
        className="input num"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder ?? '0'}
        aria-invalid={invalid || undefined}
        value={value === null ? '' : groupINR.format(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
          onChange(digits === '' ? null : Number(digits));
        }}
      />
    </div>
  );
}

export function PhoneInput({ value, onChange, id, placeholder }: {
  value: string; onChange: (v: string) => void; id?: string; placeholder?: string;
}) {
  return (
    <input
      id={id}
      className="input num"
      type="tel"
      inputMode="tel"
      autoComplete="off"
      placeholder={placeholder ?? '98765 43210'}
      value={value}
      maxLength={16}
      onChange={(e) => onChange(e.target.value.replace(/[^\d+\s-]/g, ''))}
    />
  );
}

export function SearchInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div className="search">
      <Search aria-hidden="true" />
      <input
        className="input"
        type="search"
        enterKeyHint="search"
        placeholder={placeholder}
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** A row of big toggle buttons, one of which is selected. */
export function Choices<T extends string>({ value, options, onChange, label }: {
  value: T | null;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="choices" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          className="choice"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Money({ n, className = '' }: { n: number; className?: string }) {
  return <span className={`num ${className}`}>{formatINR(n)}</span>;
}

export function Initials({ name }: { name: string }) {
  const letters = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  return <span className="avatar" aria-hidden="true">{letters || '?'}</span>;
}

// ---------- bottom sheet ----------

export function Sheet({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <div className="sheet-handle" aria-hidden="true" />
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** "Are you sure?" with the money or action spelled out. */
export function Confirm({ open, title, body, confirmLabel, danger, busy, onConfirm, onClose }: {
  open: boolean; title: string; body?: ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean;
  onConfirm: () => void; onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="stack">
        {body && <div className="muted">{body}</div>}
        <button className={`btn btn-block btn-lg ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button className="btn btn-block btn-secondary" onClick={onClose}>{t('cancel')}</button>
      </div>
    </Sheet>
  );
}

// ---------- toasts ----------

interface ToastMsg {
  id: number;
  text: string;
  kind: 'success' | 'error' | 'info';
  action?: { label: string; run: () => void };
}

const ToastCtx = createContext<(m: Omit<ToastMsg, 'id'>) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((m: Omit<ToastMsg, 'id'>) => {
    window.clearTimeout(timer.current);
    setMsg({ ...m, id: Date.now() });
    timer.current = window.setTimeout(() => setMsg(null), m.action ? 6000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-wrap" aria-live="polite">
        {msg && (
          <div key={msg.id} className={`toast ${msg.kind}`} role={msg.kind === 'error' ? 'alert' : 'status'}>
            <span>{msg.text}</span>
            {msg.action && (
              <button onClick={() => { msg.action!.run(); setMsg(null); }}>{msg.action.label}</button>
            )}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
