// File: apps/web/components/Nav.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const links = [
  { href: '/', label: 'Overview' },
  { href: '/portfolio', label: 'Holdings' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/targets', label: 'Plan' },
  { href: '/settings', label: 'Settings' },
]

export function Nav() {
  const supabase = createClient()
  const pathname = usePathname()
  const [userEmail, setUserEmail] = useState('')
  const [authChecked, setAuthChecked] = useState(false)
  const [hasUser, setHasUser] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email || '')
        setHasUser(true)
      }
      setAuthChecked(true)
    })
  }, [])

  // Only relevant on '/', the one route reachable while logged out (see middleware) —
  // every other route in this group is already auth-gated, so this never flashes
  // real nav content to a logged-out visitor there.
  if (authChecked && !hasUser) return null

  return (
    <div className="nav">
      <Link href="/" className="nav-brand">Portfolio Tracker</Link>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={pathname === link.href ? 'page' : undefined}
        >
          {link.label}
        </Link>
      ))}
      <Link href="/transactions/new" className="btn btn-primary" style={{ marginLeft: 12 }}>+ Add Transaction</Link>
      {userEmail && <span className="text-muted" style={{ fontSize: 12 }}>{userEmail}</span>}
      <form action="/auth/signout" method="post">
        <button type="submit" className="btn btn-ghost">Sign out</button>
      </form>
    </div>
  )
}
