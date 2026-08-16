// File: apps/web/components/SortableTh.tsx
import type { CSSProperties, ReactNode } from 'react'
import { Tooltip } from '@/components/Tooltip'

export type SortDir = 'asc' | 'desc'

export function SortableTh({
  label,
  tooltip,
  sortKey,
  active,
  dir,
  onSort,
  align = 'left',
  width,
}: {
  label: string
  tooltip?: ReactNode
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
      {tooltip ? <Tooltip content={tooltip}>{label}</Tooltip> : label}
      <span className="text-muted" style={{ marginLeft: 4 }}>{active ? (dir === 'asc' ? '▲' : '▼') : ''}</span>
    </th>
  )
}
