// File: apps/web/components/SortableTh.tsx
import type { CSSProperties } from 'react'

export type SortDir = 'asc' | 'desc'

export function SortableTh({
  label,
  sortKey,
  active,
  dir,
  onSort,
  align = 'left',
  width,
}: {
  label: string
  sortKey: string
  active: boolean
  dir: SortDir
  onSort: (key: string) => void
  align?: 'left' | 'right'
  width?: number
}) {
  const style: CSSProperties = { textAlign: align, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }
  if (width) style.width = width

  return (
    <th onClick={() => onSort(sortKey)} style={style}>
      {label}
      <span className="text-muted" style={{ marginLeft: 4 }}>{active ? (dir === 'asc' ? '▲' : '▼') : ''}</span>
    </th>
  )
}
