// File: apps/web/components/Tooltip.tsx
'use client'

import { useId, useState, type ReactNode } from 'react'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
}

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const id = useId()

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <span aria-describedby={visible ? id : undefined} tabIndex={0} style={{ borderBottom: '1px dotted currentColor', cursor: 'help' }}>
        {children}
      </span>
      {visible && (
        <span
          role="tooltip" id={id}
          style={{
            position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
            marginBottom: 6, padding: '6px 10px', maxWidth: 240, width: 'max-content',
            background: 'var(--color-text)', color: 'var(--color-bg)',
            fontSize: 11.5, lineHeight: 1.4, fontFamily: 'var(--font-body)', fontWeight: 400,
            textTransform: 'none', letterSpacing: 'normal',
            border: '1px solid var(--color-divider)', boxShadow: 'var(--elev-md)',
            zIndex: 20, textAlign: 'left',
          }}
        >
          {content}
        </span>
      )}
    </span>
  )
}
