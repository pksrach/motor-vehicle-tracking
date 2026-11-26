'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Gauge, ArrowRight, ShieldCheck } from 'lucide-react'
import { Trans, useLingui } from '@lingui/react/macro'
import { LanguageSwitcher } from '@/components/language-switcher'

export default function LoginPage() {
  const router = useRouter()
  const { t } = useLingui()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    const result = await signIn('credentials', {
      email: form.get('email'),
      password: form.get('password'),
      redirect: false,
    })
    setBusy(false)
    if (result?.error) setError(t`That email and password combination wasn’t recognized.`)
    else router.push('/')
  }
  return (
    <main className="auth-page">
      <div className="auth-art">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Gauge size={19} />
          </span>
          <span>
            motive<span className="brand-dot">.</span>
            <small>{t`VEHICLE CARE`}</small>
          </span>
        </Link>
        <div className="auth-art-content">
          <div className="eyebrow">
            <span className="live-dot">
              <i />
            </span>{' '}
            {t`MADE FOR EVERY MILE`}
          </div>
          <h1>
            {t`Keep the road`}
            <br />
            {t`ahead`} <em>{t`in view.`}</em>
          </h1>
          <p>{t`A calmer way to care for every vehicle you own.`}</p>
          <div className="road-lines" aria-hidden="true">
            <div />
            <div />
            <div />
          </div>
        </div>
        <span className="auth-art-foot">{t`PRIVATE VEHICLE CARE · BUILT AROUND YOU`}</span>
      </div>
      <section className="auth-form-side">
        <form className="auth-form" onSubmit={submit}>
          <div className="auth-form-tools">
            <LanguageSwitcher />
          </div>
          <div className="eyebrow">
            <Trans>WELCOME BACK</Trans>
          </div>
          <h2>
            <Trans>Sign in to your garage</Trans>
          </h2>
          <p>{t`Pick up right where you left off.`}</p>
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
          <label className="form-label">
            {t`Email address`}
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder={t`you@example.com`}
            />
          </label>
          <label className="form-label">
            {t`Password`}
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder={t`Your password`}
            />
          </label>
          <button className="button primary auth-submit" disabled={busy}>
            {busy ? t`Signing in…` : t`Sign in`} <ArrowRight size={16} />
          </button>
          <div className="auth-switch">
            {t`New to Motive?`} <Link href="/register">{t`Create an account`}</Link>
          </div>
          <div className="auth-assurance">
            <ShieldCheck size={15} /> {t`Your vehicle records stay private to your account.`}
          </div>
        </form>
      </section>
    </main>
  )
}
