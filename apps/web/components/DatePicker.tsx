// File: apps/web/components/DatePicker.tsx
'use client'

interface DatePickerProps {
  value: string // ISO date string (YYYY-MM-DD)
  onChange: (value: string) => void
  label?: string
  disabled?: boolean
  maxDate?: string // ISO date string for max allowed date
  minDate?: string // ISO date string for min allowed date
}

export default function DatePicker({
  value,
  onChange,
  label = 'Date',
  disabled = false,
  maxDate,
  minDate,
}: DatePickerProps) {
  return (
    <div>
      <label htmlFor="date-picker" className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id="date-picker"
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        max={maxDate}
        min={minDate}
        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border disabled:bg-gray-100 disabled:cursor-not-allowed"
      />
    </div>
  )
}
