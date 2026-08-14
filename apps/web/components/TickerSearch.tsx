// File: apps/web/components/TickerSearch.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { searchJSETickers, type JSETicker } from '@portfolio-tracker/api-client'

interface TickerSearchProps {
  value: string
  onChange: (value: string) => void
  onSelect?: (ticker: JSETicker) => void
  disabled?: boolean
  placeholder?: string
}

export default function TickerSearch({
  value,
  onChange,
  onSelect,
  disabled = false,
  placeholder = 'Search ticker (e.g., STX40, STXNDQ)',
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
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      />

      {showDropdown && searchResults.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
          {searchResults.map((ticker, index) => (
            <button
              key={ticker.symbol}
              type="button"
              onClick={() => handleSelectTicker(ticker)}
              className={`w-full text-left px-4 py-2 cursor-pointer ${
                index === highlightedIndex
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-900 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${
                    index === highlightedIndex ? 'text-white' : 'text-gray-900'
                  }`}>
                    {ticker.symbol}
                  </p>
                  <p className={`text-xs truncate ${
                    index === highlightedIndex ? 'text-indigo-100' : 'text-gray-500'
                  }`}>
                    {ticker.name}
                  </p>
                </div>
                <div className="ml-2 flex-shrink-0">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    index === highlightedIndex
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {ticker.provider}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showDropdown && value.trim().length > 0 && searchResults.length === 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md py-3 px-4 text-sm text-gray-500 ring-1 ring-black ring-opacity-5">
          No tickers found matching "{value}". You can still enter it manually if it's valid.
        </div>
      )}
    </div>
  )
}
