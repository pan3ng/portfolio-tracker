// File: apps/web/components/Tag.tsx
'use client'

interface TagProps {
  label: string
  onRemove?: () => void
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
}

const variantClass: Record<NonNullable<TagProps['variant']>, string> = {
  default: 'tag-neutral',
  primary: 'tag-accent',
  success: 'tag-accent-2',
  warning: 'tag-outline',
  danger: 'tag-outline',
}

export default function Tag({ label, onRemove, variant = 'default' }: TagProps) {
  return (
    <span className={`tag ${variantClass[variant]}`} style={{ gap: 4 }}>
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label} tag`}
          style={{ display: 'inline-flex', opacity: 0.6, marginLeft: 2 }}
        >
          ×
        </button>
      )}
    </span>
  )
}
