// File: apps/web/components/LandingPage.tsx
'use client'

import Link from 'next/link'
import { Card } from '@/components/Card'

const FEATURES = [
  {
    title: 'Real fee breakdown',
    body: 'Every buy shows the actual JSE costs — brokerage, settlement, investor protection levy, VAT, securities transfer tax — not a single lumped estimate.',
  },
  {
    title: 'Target-weight planning',
    body: 'Set the split you’re aiming for per holding. See exactly how far off plan you are, and what to buy to get back on track.',
  },
  {
    title: 'Multi-account, ZAR & USD',
    body: 'Track ZAR and USD accounts side by side, with account-aware amounts and fees throughout.',
  },
  {
    title: 'Deposits & uninvested capital',
    body: 'Log cash into your accounts separately from what you’ve invested, so you always know what’s sitting ready to deploy.',
  },
]

export default function LandingPage() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
        <span className="nav-brand" style={{ marginRight: 'auto' }}>Portfolio Tracker</span>
        <Link href="/login" className="btn btn-primary">Log in</Link>
      </div>

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: 'var(--space-8) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
        <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.1 }}>Know exactly where your portfolio stands.</h1>
          <p style={{ fontSize: 16, opacity: 0.75, margin: 0, textWrap: 'pretty' }}>
            A JSE portfolio tracker built for people who want the real numbers — actual
            fees, actual drift from your plan, actual uninvested cash — not a rounded-off
            summary.
          </p>
          <div>
            <Link href="/login" className="btn btn-primary" style={{ minHeight: 44 }}>Get started</Link>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)' }}>
          {FEATURES.map((f) => (
            <Card key={f.title} style={{ padding: 'var(--space-5)' }}>
              <div className="card-title" style={{ marginBottom: 6 }}>{f.title}</div>
              <p className="text-muted" style={{ fontSize: 13.5, margin: 0, textWrap: 'pretty' }}>{f.body}</p>
            </Card>
          ))}
        </div>

        <div>
          <div className="card-kicker" style={{ marginBottom: 10 }}>Preview — illustrative data</div>
          <Card style={{ padding: 'var(--space-5)', maxWidth: 480 }}>
            <div className="metric-label">Off your plan by</div>
            <div className="num metric-value" style={{ fontSize: 22, color: 'var(--color-loss)', marginBottom: 14 }}>4.2 pts</div>
            <table className="table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th style={{ textAlign: 'right' }}>Weight</th>
                  <th style={{ textAlign: 'right' }}>Target</th>
                  <th style={{ textAlign: 'right' }}>P/L</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>STX40</td>
                  <td className="num" style={{ textAlign: 'right' }}>33.1%</td>
                  <td className="num text-muted" style={{ textAlign: 'right' }}>25.0%</td>
                  <td className="num" style={{ textAlign: 'right', color: 'var(--color-gain)' }}>+12.4%</td>
                </tr>
                <tr>
                  <td>STXNDQ</td>
                  <td className="num" style={{ textAlign: 'right' }}>28.9%</td>
                  <td className="num text-muted" style={{ textAlign: 'right' }}>30.0%</td>
                  <td className="num" style={{ textAlign: 'right', color: 'var(--color-loss)' }}>-3.1%</td>
                </tr>
              </tbody>
            </table>
          </Card>
        </div>

        <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>
          Your holdings are private to your account. We never see your broker login.
        </p>
      </div>
    </div>
  )
}
