'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Gauge, ArrowRight, ShieldCheck } from 'lucide-react'
import { Trans, useLingui } from '@lingui/react/macro'
import { registerAccount } from '@/app/actions/auth'
import { LanguageSwitcher } from '@/components/language-switcher'

export default function RegisterPage() {
  const router = useRouter()
  const { t } = useLingui()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    const errorTranslations: Record<string, string> = {
      'An account with this email already exists.': t`An account with this email already exists.`,
      'Your account is ready. Please sign in to continue.': t`Your account is ready. Please sign in to continue.`,
    }
    try {
      await registerAccount({
        name: form.get('name'),
        email: form.get('email'),
        password: form.get('password'),
      })
      const result = await signIn('credentials', {
        email: form.get('email'),
        password: form.get('password'),
        redirect: false,
      })
      if (result?.error) throw new Error('Your account is ready. Please sign in to continue.')
      router.push('/')
    } catch (caught) {
      setError(
        caught instanceof Error
          ? (errorTranslations[caught.message] ?? caught.message)
          : t`Could not create your account.`,
      )
      setBusy(false)
    }
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
            {t`YOUR GARAGE STARTS HERE`}
          </div>
          <h1>
            {t`Every visit.`}
            <br />
            {t`Every mile.`}
            <br />
            <em>{t`Remembered.`}</em>
          </h1>
          <p>{t`Build a service history that helps you stay one step ahead.`}</p>
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
          <div className="eyebrow">{t`GET STARTED`}</div>
          <h2>
            <Trans>Create your account</Trans>
          </h2>
          <p>{t`Your vehicles and records, kept together.`}</p>
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
          <label className="form-label">
            {t`Your name`}
            <input
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={80}
              placeholder={t`Alex Morgan`}
            />
          </label>
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
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              placeholder={t`At least 8 characters`}
            />
          </label>
          <button className="button primary auth-submit" disabled={busy}>
            {busy ? t`Creating account…` : t`Create account`} <ArrowRight size={16} />
          </button>
          <div className="auth-switch">
            {t`Already have an account?`} <Link href="/login">{t`Sign in`}</Link>
          </div>
          <div className="auth-assurance">
            <ShieldCheck size={15} /> {t`Your vehicle records stay private to your account.`}
          </div>
        </form>
      </section>
    </main>
  )
}
