'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/db';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(''); setMsg(''); setBusy(true);
    try {
      if (mode === 'in') {
        const { error } = await supabase().auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace('/quotations');
      } else {
        const { data, error } = await supabase().auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) router.replace('/quotations');
        else setMsg('Account created. Check your email to confirm, then sign in.');
      }
    } catch (e2) {
      setErr(e2.message || String(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '60px 16px' }}>
      <h1 style={{ fontSize: 26, margin: '0 0 4px' }}>Amol Digital</h1>
      <p className="note" style={{ marginTop: 0, marginBottom: 22 }}>
        Billing, quotations and recovery
      </p>
      <div className="card">
        {err && <div className="err">{err}</div>}
        {msg && <div className="okmsg">{msg}</div>}
        <form onSubmit={submit}>
          <div className="field" style={{ marginBottom: 11 }}>
            <label htmlFor="em">Email</label>
            <input id="em" type="email" autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label htmlFor="pw">Password</label>
            <input id="pw" type="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <button className="btn" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <p className="note">
          {mode === 'in' ? 'First time here? ' : 'Already have an account? '}
          <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === 'in' ? 'up' : 'in'); setErr(''); setMsg(''); }}>
            {mode === 'in' ? 'Create an account' : 'Sign in'}
          </a>
        </p>
      </div>
      <p className="note">
        The first account created becomes the owner of the shop. Create yours before anyone else.
      </p>
    </div>
  );
}
