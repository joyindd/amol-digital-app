'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../lib/db';

const NAV = [
  { href: '/quotations', label: 'Quotations' },
  { href: '/invoices', label: 'Bills' },
  { href: '/receivables', label: 'Recovery' },
  { href: '/customers', label: 'Customers' },
  { href: '/rates', label: 'Rate card' },
];

export default function Shell({ children }) {
  const path = usePathname() || '';
  const router = useRouter();
  const [email, setEmail] = useState(null);
  const [ready, setReady] = useState(false);
  const isLogin = path === '/login';

  useEffect(() => {
    let mounted = true;
    supabase().auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setEmail(data.session?.user?.email || null);
      setReady(true);
      if (!data.session && !isLogin) router.replace('/login');
    });
    const { data: sub } = supabase().auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email || null);
      if (!session && !isLogin) router.replace('/login');
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [isLogin, router]);

  async function signOut() {
    await supabase().auth.signOut();
    router.replace('/login');
  }

  if (isLogin) return <>{children}</>;
  if (!ready) return <div className="shell"><p className="note">Loading…</p></div>;
  if (!email) return null;

  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <div className="brand">Amol Digital</div>
          <nav>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={path.startsWith(n.href) ? 'on' : ''}>
                {n.label}
              </Link>
            ))}
          </nav>
          <span className="who">{email}</span>
          <button className="btn ghost" style={{ minHeight: 36, padding: '6px 12px' }} onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>
      <div className="colorbar"><i /><i /><i /><i /></div>
      {children}
    </>
  );
}
