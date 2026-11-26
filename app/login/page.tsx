'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { Gauge, ArrowRight, ShieldCheck } from 'lucide-react'

export default function LoginPage() {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(''); const form = new FormData(event.currentTarget); const result = await signIn('credentials', { email: form.get('email'), password: form.get('password'), redirect: false }); setBusy(false); if (result?.error) setError('That email and password combination wasn’t recognized.'); else window.location.assign('/') }
  return <main className="auth-page"><div className="auth-art"><Link href="/" className="brand"><span className="brand-mark"><Gauge size={19} /></span><span>motive<span className="brand-dot">.</span><small>VEHICLE CARE</small></span></Link><div className="auth-art-content"><div className="eyebrow"><span className="live-dot"><i /></span> MADE FOR EVERY MILE</div><h1>Keep the road<br />ahead <em>in view.</em></h1><p>A calmer way to care for every vehicle you own.</p><div className="road-lines" aria-hidden="true"><div /><div /><div /></div></div><span className="auth-art-foot">PRIVATE VEHICLE CARE · BUILT AROUND YOU</span></div><section className="auth-form-side"><form className="auth-form" onSubmit={submit}><div className="eyebrow">WELCOME BACK</div><h2>Sign in to your garage</h2><p>Pick up right where you left off.</p>{error && <div className="auth-error" role="alert">{error}</div>}<label className="form-label">Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label><label className="form-label">Password<input name="password" type="password" autoComplete="current-password" required placeholder="Your password" /></label><button className="button primary auth-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} /></button><div className="auth-switch">New to Motive? <Link href="/register">Create an account</Link></div><div className="auth-assurance"><ShieldCheck size={15} /> Your vehicle records stay private to your account.</div></form></section></main>
}
