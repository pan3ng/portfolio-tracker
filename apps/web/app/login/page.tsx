// File: app/login/page.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/Card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error

      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
        <Card style={{ width: 440, maxWidth: '100%', padding: '44px 36px 40px', gap: 'var(--space-6)' }}>
          <span className="nav-brand" style={{ fontSize: 19 }}>Portfolio Tracker</span>
          <div>
            <h2 style={{ margin: '0 0 8px', fontSize: 30 }}>Check your email</h2>
            <p style={{ fontSize: 14, opacity: 0.7, margin: 0 }}>
              We sent a sign-in link to <span className="num">{email}</span>. It works once and expires shortly.
            </p>
          </div>
          <Card style={{ background: 'var(--color-accent-wash)', fontSize: 13.5, padding: 18 }}>
            Didn&apos;t arrive? Check spam, or go back and send it again.
          </Card>
          <button onClick={() => setSent(false)} className="btn btn-secondary btn-block" style={{ justifyContent: 'center', minHeight: 44 }}>
            Use a different email
          </button>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
      <Card style={{ width: 440, maxWidth: '100%', padding: '44px 36px 40px', gap: 'var(--space-6)' }}>
        <span className="nav-brand" style={{ fontSize: 19 }}>Portfolio Tracker</span>
        <div>
          <h2 style={{ margin: '0 0 8px', fontSize: 30 }}>Sign in</h2>
          <p style={{ fontSize: 14, opacity: 0.7, margin: 0 }}>We&apos;ll email you a link. No password to remember, nothing to reset.</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div className="field">
            <label htmlFor="email">Your email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.co.za"
            />
          </div>

          {error && (
            <Card style={{ borderColor: 'var(--color-loss)' }}>
              <p style={{ margin: 0, color: 'var(--color-loss)' }}>{error}</p>
            </Card>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary btn-block" style={{ justifyContent: 'center', minHeight: 44, marginTop: 0 }}>
            {loading ? 'Sending...' : 'Email me a link'}
          </button>
        </form>
        <p style={{ fontSize: 12, opacity: 0.55, margin: 0 }}>
          Your holdings are private to your account. We never see your broker login.
        </p>
      </Card>
    </div>
  )
}
