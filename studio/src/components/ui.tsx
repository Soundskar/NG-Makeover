import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, CheckCircle2, Inbox, Info, RefreshCw, Search, WifiOff, X } from 'lucide-react';
import {
  createContext, useCallback, useContext, useEffect, useId, useRef, useState,
  type InputHTMLAttributes, type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { errorText, useI18n } from '../i18n/i18n';
import { haptic } from '../lib/haptics';
import { formatINR } from '../lib/money';

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

// ---------- page frame ----------

/**
 * `back` goes to the screen you came from. When the app was opened straight on
 * this screen (a shared link, a reload) there is nothing to go back to, so it
 * goes to `back` if that's a path, or Home.
 */
export function TopBar({ title, back, actions }: { title: string; back?: boolean | string; actions?: ReactNode }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(typeof back === 'string' ? back : '/', { replace: true });
  };
  return (
    <header className="topbar">
      {back && (
        <button className="icon-btn" aria-label={t('back')} onClick={goBack}>
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

/** Grey placeholder shapes while a list loads, so the page doesn't jump. */
export function Skeleton({ rows = 4, variant = 'list' }: { rows?: number; variant?: 'list' | 'cards' }) {
  const { t } = useI18n();
  return (
    <div role="status" aria-label={t('loading')} className={variant === 'list' ? 'list' : 'stack'}>
      {Array.from({ length: rows }, (_, i) => (
        variant === 'list' ? (
          <div key={i} className="list-item" aria-hidden="true">
            <span className="skel skel-circle" />
            <span className="grow stack" style={{ gap: 8 }}>
              <span className="skel" style={{ width: `${70 - i * 9}%` }} />
              <span className="skel skel-sm" style={{ width: `${45 + i * 7}%` }} />
            </span>
          </div>
        ) : (
          <div key={i} className="card stack" aria-hidden="true" style={{ gap: 10 }}>
            <span className="skel skel-sm" style={{ width: '40%' }} />
            <span className="skel skel-lg" style={{ width: '60%' }} />
          </div>
        )
      ))}
    </div>
  );
}

export function Empty({ title, sub, icon }: { title: string; sub?: string; icon?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">{icon ?? <Inbox />}</span>
      <p className="title">{title}</p>
      {sub && <p>{sub}</p>}
    </div>
  );
}

export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="notice notice-danger shake" role="alert">
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

/** Shows a placeholder / error / children depending on a React Query result. */
export function Loaded<T>({ q, children, skeleton = 'list' }: {
  q: { data: T | undefined; isPending: boolean; error: unknown; refetch: () => unknown };
  children: (data: T) => ReactNode;
  skeleton?: 'list' | 'cards' | 'spinner';
}) {
  if (q.error) return <ErrorBox error={q.error} retry={() => q.refetch()} />;
  if (q.isPending || q.data === undefined) {
    return skeleton === 'spinner' ? <Spinner /> : <Skeleton variant={skeleton} rows={skeleton === 'cards' ? 3 : 4} />;
  }
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

/** Pull down at the top of any screen to fetch fresh numbers (the installed app has no reload button). */
export function PullToRefresh() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let startY: number | null = null;
    let current = 0;
    const down = (e: TouchEvent) => {
      // Not while a sheet is open (it locks the page) or the page is scrolled.
      if (window.scrollY > 0 || document.body.style.overflow === 'hidden' || e.touches.length !== 1) return;
      startY = e.touches[0]!.clientY;
    };
    const move = (e: TouchEvent) => {
      if (startY == null) return;
      const dy = e.touches[0]!.clientY - startY;
      current = dy > 0 && window.scrollY <= 0 ? Math.min(110, dy * 0.45) : 0;
      setPull(current);
    };
    const up = async () => {
      if (startY == null) return;
      startY = null;
      if (current >= 60) {
        haptic();
        setBusy(true);
        setPull(52);
        await qc.refetchQueries({ type: 'active' });
        setBusy(false);
      }
      current = 0;
      setPull(0);
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up);
    window.addEventListener('touchcancel', up);
    return () => {
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
      window.removeEventListener('touchcancel', up);
    };
  }, [qc]);
  if (!pull && !busy) return null;
  const ready = pull >= 60 || busy;
  return (
    <div className="ptr" style={{ transform: `translate(-50%, ${pull}px)`, opacity: Math.min(1, pull / 40) }}
      role="status" aria-label={busy ? t('refreshing') : t('pull_refresh')}>
      <RefreshCw className={busy ? 'spinning' : ''} style={busy ? undefined : { transform: `rotate(${pull * 3}deg)` }}
        color={ready ? 'var(--primary)' : 'var(--text-2)'} />
    </div>
  );
}

// ---------- numbers ----------

/** Eases a number from its last value to the new one, so totals visibly "count up". */
function useCountUp(target: number, enabled: boolean, ms = 500): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    if (!enabled || start === target || reducedMotion()) {
      from.current = target;
      setShown(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const v = Math.round(start + (target - start) * (1 - (1 - p) ** 3));
      from.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled, ms]);
  return shown;
}

export function Money({ n, className = '', animate = false }: { n: number; className?: string; animate?: boolean }) {
  const shown = useCountUp(n, animate);
  return <span className={`num ${className}`}>{formatINR(shown)}</span>;
}

/** A plain count that animates like Money. */
export function Count({ n, className = '' }: { n: number; className?: string }) {
  const shown = useCountUp(n, true);
  return <span className={`num ${className}`}>{shown}</span>;
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
        // Tapping into an amount selects it, so typing replaces it instead of adding digits.
        onFocus={(e) => e.currentTarget.select()}
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
  const { t } = useI18n();
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
      {value && (
        <button type="button" className="search-clear" aria-label={t('clear')} onClick={() => onChange('')}>
          <X />
        </button>
      )}
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
          onClick={() => { haptic(); onChange(o.value); }}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A big tappable row with a real checkbox, so the whole row toggles. */
export function CheckRow({ checked, onChange, label, sub }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string;
}) {
  return (
    <label className="check-row">
      <input type="checkbox" checked={checked} onChange={(e) => { haptic(); onChange(e.target.checked); }} />
      <span className="grow">
        <span style={{ display: 'block', fontWeight: 600 }}>{label}</span>
        {sub && <span className="muted small">{sub}</span>}
      </span>
    </label>
  );
}

const TINTS = 6;
/** The same name always gets the same colour, so people are easy to tell apart in lists. */
export function tintOf(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % TINTS;
}

export function Initials({ name }: { name: string }) {
  const letters = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  return <span className="avatar" data-tint={tintOf(name)} aria-hidden="true">{letters || '?'}</span>;
}

// ---------- bottom sheet ----------

const SheetCloseCtx = createContext<() => void>(() => {});
/** Closes the sheet this is inside, with its slide-down animation. */
export const useSheetClose = () => useContext(SheetCloseCtx);

export function Sheet({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [closing, setClosing] = useState(false);
  const [drag, setDrag] = useState(0);
  const dragStart = useRef<number | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const requestClose = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      setDrag(0);
      onCloseRef.current();
    }, reducedMotion() ? 0 : 180);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && requestClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const before = document.activeElement as HTMLElement | null;
    // Inputs marked autoFocus are already focused; otherwise focus the sheet
    // itself, so the phone keyboard doesn't jump up over it.
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      before?.focus?.({ preventScroll: true });
    };
  }, [open, requestClose]);

  if (!open) return null;

  const endDrag = (cancel: boolean) => {
    if (dragStart.current == null) return;
    dragStart.current = null;
    if (!cancel && drag > 90) requestClose();
    else setDrag(0);
  };
  const style = closing ? { transform: 'translateY(105%)', transition: 'transform 0.18s ease-in' }
    : drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined;

  return (
    <div className={`sheet-backdrop${closing ? ' closing' : ''}`} onClick={(e) => e.target === e.currentTarget && requestClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1} style={style}>
        <div
          className="sheet-grab"
          onPointerDown={(e) => {
            dragStart.current = e.clientY;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => dragStart.current != null && setDrag(Math.max(0, e.clientY - dragStart.current))}
          onPointerUp={() => endDrag(false)}
          onPointerCancel={() => endDrag(true)}
        >
          <div className="sheet-handle" aria-hidden="true" />
          <h2 id={titleId}>{title}</h2>
        </div>
        <SheetCloseCtx.Provider value={requestClose}>{children}</SheetCloseCtx.Provider>
      </div>
    </div>
  );
}

/** A secondary "Cancel" / "Close" button that slides its sheet away. */
export function SheetCloseButton({ label }: { label?: string }) {
  const { t } = useI18n();
  const close = useSheetClose();
  return <button type="button" className="btn btn-block btn-secondary" onClick={close}>{label ?? t('cancel')}</button>;
}

/** "Are you sure?" with the money or action spelled out. */
export function Confirm({ open, title, body, confirmLabel, danger, busy, onConfirm, onClose }: {
  open: boolean; title: string; body?: ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean;
  onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="stack">
        {body && <div className="muted">{body}</div>}
        <button className={`btn btn-block btn-lg ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy} aria-busy={busy}
          onClick={onConfirm}>
          {confirmLabel}
        </button>
        <SheetCloseButton />
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

const toastIcon = { success: <CheckCircle2 />, error: <AlertTriangle />, info: <Info /> } as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const leaveTimer = useRef<number | undefined>(undefined);

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current);
    setLeaving(true);
    leaveTimer.current = window.setTimeout(() => {
      setMsg(null);
      setLeaving(false);
    }, 180);
  }, []);

  const show = useCallback((m: Omit<ToastMsg, 'id'>) => {
    window.clearTimeout(timer.current);
    window.clearTimeout(leaveTimer.current);
    setLeaving(false);
    setMsg({ ...m, id: Date.now() });
    if (m.kind === 'success') haptic('success');
    else if (m.kind === 'error') haptic('warning');
    timer.current = window.setTimeout(dismiss, m.action ? 6000 : 3500);
  }, [dismiss]);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-wrap" aria-live="polite">
        {msg && (
          <div key={msg.id} className={`toast ${msg.kind}${leaving ? ' leaving' : ''}`} role={msg.kind === 'error' ? 'alert' : 'status'}
            onClick={(e) => e.target === e.currentTarget && dismiss()}>
            {toastIcon[msg.kind]}
            <span className="grow" onClick={dismiss}>{msg.text}</span>
            {msg.action && (
              <button onClick={() => { msg.action!.run(); dismiss(); }}>{msg.action.label}</button>
            )}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
