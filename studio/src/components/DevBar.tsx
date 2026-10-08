import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEV_ROLES, devRole, devSignIn, type DevRole } from '../auth/devMode';

/** Test mode only: shows which test account is signed in and switches between them. */
export function DevBar() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [role, setRole] = useState<DevRole>(devRole);
  const [busy, setBusy] = useState(false);

  async function pick(r: DevRole) {
    if (r === role || busy) return;
    setBusy(true);
    qc.clear();
    await devSignIn(r);
    setRole(r);
    setBusy(false);
    navigate('/', { replace: true });
  }

  return (
    <div className="dev-bar" role="region" aria-label="Test mode">
      <strong>TEST MODE</strong>
      {DEV_ROLES.map((r) => (
        <button key={r} aria-pressed={r === role} disabled={busy} onClick={() => pick(r)}>{r}</button>
      ))}
    </div>
  );
}
