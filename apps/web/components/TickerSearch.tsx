// File: apps/web/components/TickerSearch.tsx
'use client'

import { useState, useRef, useEffect, type CSSProperties } from 'react'
import { searchJSETickers, type JSETicker } from '@portfolio-tracker/api-client'

interface TickerSearchProps {
  value: string
  onChange: (value: string) => void
  onSelect?: (ticker: JSETicker) => void
  disabled?: boolean
  placeholder?: string
  inputClassName?: string
  inputStyle?: CSSProperties
}

export default function TickerSearch({
  value,
  onChange,
  onSelect,
  disabled = false,
  placeholder = 'Search ticker (e.g., STX40, STXNDQ)',
  inputClassName = 'input',
  inputStyle,
}: TickerSearchProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchResults, setSearchResults] = useState<JSETicker[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Close dropdown when clicking outside
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (inputValue: string) => {
    onChange(inputValue)

    if (inputValue.trim().length > 0) {
      const results = searchJSETickers(inputValue)
      setSearchResults(results.slice(0, 10)) // Limit to 10 results
      setShowDropdown(true)
      setHighlightedIndex(-1)
    } else {
      setSearchResults([])
      setShowDropdown(false)
    }
  }

  const handleSelectTicker = (ticker: JSETicker) => {
    onChange(ticker.symbol)
    setShowDropdown(false)
    setSearchResults([])
    if (onSelect) {
      onSelect(ticker)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || searchResults.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
          const selectedTicker = searchResults[highlightedIndex]
          if (selectedTicker) {
            handleSelectTicker(selectedTicker)
          }
        }
        break
      case 'Escape':
        setShowDropdown(false)
        break
    }
  }

  const handleFocus = () => {
    if (value.trim().length > 0) {
      const results = searchJSETickers(value)
      setSearchResults(results.slice(0, 10))
      setShowDropdown(true)
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <input
        type="text"
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        className={inputClassName}
        style={inputStyle}
      />

      {showDropdown && searchResults.length > 0 && (
        <div
          style={{
            position: 'absolute', zIndex: 10, marginTop: 4, width: '100%',
            background: 'var(--color-surface)', border: '1px solid var(--color-divider)',
            boxShadow: 'var(--elev-md)', maxHeight: 240, overflow: 'auto',
          }}
        >
          {searchResults.map((ticker, index) => {
            const active = index === highlightedIndex
            return (
              <button
                key={ticker.symbol}
                type="button"
                onClick={() => handleSelectTicker(ticker)}
                style={{
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
                  width: '100%', textAlign: 'left', padding: '8px 12px', cursor: 'pointer',
                  border: 'none', background: active ? 'var(--color-accent)' : 'transparent',
                  color: active ? 'var(--color-bg)' : 'var(--color-text)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="num" style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ticker.symbol}
                  </div>
                  <div style={{ fontSize: 11, opacity: active ? 0.85 : 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ticker.name}
                  </div>
                </div>
                <span className="tag tag-neutral" style={{ flexShrink: 0 }}>{ticker.provider}</span>
              </button>
            )
          })}
        </div>
      )}

      {showDropdown && value.trim().length > 0 && searchResults.length === 0 && (
        <div
          style={{
            position: 'absolute', zIndex: 10, marginTop: 4, width: '100%',
            background: 'var(--color-surface)', border: '1px solid var(--color-divider)',
            boxShadow: 'var(--elev-md)', padding: '12px 16px', fontSize: 13, color: 'var(--color-text)',
          }}
        >
          No tickers found matching &quot;{value}&quot;. You can still enter it manually if it&apos;s valid.
        </div>
      )}
    </div>
  )
}
