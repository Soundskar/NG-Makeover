import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, KeyRound, Power, Share2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useMe, useTeam } from '../../auth/auth';
import { Choices, ErrorBox, Field, Initials, Loaded, Page, PhoneInput, Sheet, TopBar, useToast } from '../../components/ui';
import { useI18n, type TFn } from '../../i18n/i18n';
import { supabase } from '../../lib/supabase';
import type { Lang, Profile } from '../../lib/types';
import { waShareLink } from '../../lib/whatsapp';

async function manage(body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('manage-staff', { body });
  if (error) {
    // The function explains refusals in its JSON body.
    const ctx = (error as { context?: Response }).context;
    const msg = ctx ? ((await ctx.json().catch(() => null)) as { error?: string } | null)?.error : null;
    throw new Error(msg ?? error.message);
  }
  return data;
}

const randomPin = () => String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0]! % 900000));

function roleText(p: Profile, t: TFn) {
  return [p.is_owner && t('role_owner'), p.is_trainer && t('role_trainer'), p.is_staff && t('role_staff')].filter(Boolean).join(', ');
}

/** Owner: who can log in, and as what. */
export default function TeamPage() {
  const { t } = useI18n();
  const team = useTeam();
  const [person, setPerson] = useState<Profile | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <>
      <TopBar title={t('team_title')} back="/more" />
      <Page>
        <Loaded q={team}>
          {(all) => (
            <div className="list">
              {all.map((p) => (
                <button key={p.id} className="list-item" onClick={() => setPerson(p)} style={{ opacity: p.active ? 1 : 0.55 }}>
                  <Initials name={p.display_name} />
                  <span className="grow">
                    <span className="title" style={{ display: 'block' }}>{p.display_name}</span>
                    <span className="sub">@{p.username} · {roleText(p, t)}</span>
                  </span>
                  {!p.active && <span className="badge badge-neutral">{t('login_off')}</span>}
                  <ChevronRight className="chev" />
                </button>
              ))}
            </div>
          )}
        </Loaded>
        <button className="btn btn-primary btn-lg btn-block" onClick={() => setAdding(true)}><UserPlus /> {t('team_add')}</button>
        {adding && <AddSheet onClose={() => setAdding(false)} />}
        {person && <PersonSheet person={person} onClose={() => setPerson(null)} />}
      </Page>
    </>
  );
}

function RoleChecks({ roles, onChange }: {
  roles: { is_owner: boolean; is_trainer: boolean; is_staff: boolean };
  onChange: (r: { is_owner: boolean; is_trainer: boolean; is_staff: boolean }) => void;
}) {
  const { t } = useI18n();
  const items = [
    ['is_staff', t('role_staff'), t('role_staff_sub')],
    ['is_trainer', t('role_trainer'), t('role_trainer_sub')],
    ['is_owner', t('role_owner'), t('role_owner_sub')],
  ] as const;
  return (
    <div className="list">
      {items.map(([k, label, sub]) => (
        <label key={k} className="list-item" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={roles[k]} onChange={(e) => onChange({ ...roles, [k]: e.target.checked })} />
          <span className="grow"><span className="title" style={{ display: 'block' }}>{label}</span><span className="sub">{sub}</span></span>
        </label>
      ))}
    </div>
  );
}

function AddSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [touched, setTouched] = useState(false);
  const [pin, setPin] = useState(randomPin);
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState<Lang>('hi');
  const [roles, setRoles] = useState({ is_owner: false, is_trainer: false, is_staff: true });
  const [done, setDone] = useState(false);

  const suggested = name.toLowerCase().split(/\s+/)[0]?.replace(/[^a-z0-9]/g, '').slice(0, 20) ?? '';
  const user = touched ? username : suggested;
  const valid = name.trim() && /^[a-z0-9]{3,20}$/.test(user) && /^\d{6}$/.test(pin) && (roles.is_owner || roles.is_trainer || roles.is_staff);

  const m = useMutation({
    mutationFn: () => manage({ action: 'create', username: user, pin, display_name: name, language, phone, ...roles }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] });
      setDone(true);
    },
  });

  if (done) {
    const msg = t('team_share_msg', { name: name.split(' ')[0] ?? name, url: window.location.origin, username: user, pin });
    return (
      <Sheet open onClose={onClose} title={t('team_created')}>
        <div className="stack">
          <div className="notice notice-success" style={{ animation: 'row-in 0.3s' }}>
            <span className="grow">{t('team_created')}</span>
          </div>
          <div className="card stack" style={{ gap: 4 }}>
            <span className="muted small">{t('username')}</span><strong className="num" style={{ fontSize: '1.25rem' }}>{user}</strong>
            <span className="muted small">{t('pin')}</span><strong className="num" style={{ fontSize: '1.25rem', letterSpacing: '0.15em' }}>{pin}</strong>
          </div>
          <p className="muted small">{t('team_created_hint')}</p>
          <a className="btn btn-whatsapp btn-lg btn-block" href={waShareLink(msg)} target="_blank" rel="noopener"><Share2 /> {t('team_share')}</a>
          <button className="btn btn-secondary btn-block" onClick={onClose}>{t('done')}</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} title={t('team_add')}>
      <div className="stack">
        <Field label={t('full_name')} htmlFor="t-n"><input id="t-n" className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={t('username')} htmlFor="t-u" hint={t('username_hint')}>
          <input id="t-u" className="input" autoCapitalize="none" spellCheck={false} value={user}
            onChange={(e) => { setTouched(true); setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '')); }} />
        </Field>
        <Field label={t('pin')} htmlFor="t-p" hint={t('pin_hint')}>
          <div className="row">
            <input id="t-p" className="input num grow" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
            <button type="button" className="btn btn-secondary" onClick={() => setPin(randomPin())}>{t('pin_new')}</button>
          </div>
        </Field>
        <Field label={`${t('phone')} (${t('optional')})`} htmlFor="t-ph"><PhoneInput id="t-ph" value={phone} onChange={setPhone} /></Field>
        <Field label={t('language')}>
          <Choices<Lang> label={t('language')} value={language} onChange={setLanguage}
            options={[{ value: 'hi', label: 'हिंदी' }, { value: 'en', label: 'English' }]} />
        </Field>
        <span className="field-label">{t('team_roles')}</span>
        <RoleChecks roles={roles} onChange={setRoles} />
        {m.error && <ErrorBox error={m.error} />}
        <button className="btn btn-primary btn-lg btn-block" disabled={!valid || m.isPending} aria-busy={m.isPending} onClick={() => m.mutate()}>
          <Check /> {t('team_create')}
        </button>
      </div>
    </Sheet>
  );
}

function PersonSheet({ person, onClose }: { person: Profile; onClose: () => void }) {
  const me = useMe();
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(person.display_name);
  const [phone, setPhone] = useState(person.phone ?? '');
  const [roles, setRoles] = useState({ is_owner: person.is_owner, is_trainer: person.is_trainer, is_staff: person.is_staff });
  const [pin, setPin] = useState('');
  const self = person.id === me.id;

  const done = (text: string) => {
    qc.invalidateQueries({ queryKey: ['team'] });
    toast({ kind: 'success', text });
  };
  const save = useMutation({
    mutationFn: () => manage({ action: 'update', user_id: person.id, display_name: name, phone, ...roles }),
    onSuccess: () => { done(t('saved')); onClose(); },
  });
  const toggle = useMutation({
    mutationFn: () => manage({ action: 'update', user_id: person.id, active: !person.active }),
    onSuccess: () => { done(person.active ? t('login_switched_off') : t('login_switched_on')); onClose(); },
  });
  const reset = useMutation({
    mutationFn: () => manage({ action: 'reset_pin', user_id: person.id, pin }),
    onSuccess: () => done(t('pin_reset_done', { pin })),
  });

  return (
    <Sheet open onClose={onClose} title={person.display_name}>
      <div className="stack-lg">
        <div className="stack">
          <Field label={t('full_name')} htmlFor="p-n"><input id="p-n" className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label={t('phone')} htmlFor="p-ph"><PhoneInput id="p-ph" value={phone} onChange={setPhone} /></Field>
          <span className="field-label">{t('team_roles')}</span>
          <RoleChecks roles={roles} onChange={(r) => setRoles(self ? { ...r, is_owner: true } : r)} />
          {save.error && <ErrorBox error={save.error} />}
          <button className="btn btn-primary btn-block" disabled={!name.trim() || save.isPending} aria-busy={save.isPending} onClick={() => save.mutate()}>
            <Check /> {t('save')}
          </button>
        </div>

        <div className="stack">
          <span className="field-label">{t('pin_reset')}</span>
          <div className="row">
            <input className="input num grow" inputMode="numeric" maxLength={6} placeholder="000000" aria-label={t('pin')}
              value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
            <button type="button" className="btn btn-secondary" onClick={() => setPin(randomPin())}>{t('pin_new')}</button>
          </div>
          {reset.error && <ErrorBox error={reset.error} />}
          <button className="btn btn-soft btn-block" disabled={pin.length !== 6 || reset.isPending} aria-busy={reset.isPending} onClick={() => reset.mutate()}>
            <KeyRound /> {t('pin_reset')}
          </button>
        </div>

        {!self && (
          <div className="stack">
            {toggle.error && <ErrorBox error={toggle.error} />}
            <button className={`btn btn-block ${person.active ? 'btn-danger' : 'btn-secondary'}`} disabled={toggle.isPending} aria-busy={toggle.isPending} onClick={() => toggle.mutate()}>
              <Power /> {person.active ? t('login_switch_off') : t('login_switch_on')}
            </button>
            {person.active && <p className="muted small">{t('login_switch_off_hint')}</p>}
          </div>
        )}
      </div>
    </Sheet>
  );
}
