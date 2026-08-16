// File: apps/web/components/Card.tsx
import type { CSSProperties, ReactNode } from 'react'

/**
 * Every framed object in the Industry design system wears four `+`
 * registration marks at its corners — this is the single place that draws
 * them, so a restyle can never drop them again.
 */
export function Card({
  children,
  className = '',
  style,
  dashed = false,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
  dashed?: boolean
}) {
  return (
    <div
      className={`card blueprint ${className}`.trim()}
      style={dashed ? { borderStyle: 'dashed', ...style } : style}
    >
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
      {children}
    </div>
  )
}
