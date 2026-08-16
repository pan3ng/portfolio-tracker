// File: apps/web/components/TagInput.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import Tag from './Tag'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
  placeholder?: string
  maxTags?: number
}

const DEFAULT_SUGGESTIONS = [
  'dividend reinvest',
  'rebalance',
  'monthly contribution',
  'bonus investment',
  'emergency withdrawal',
  'lump sum',
  'dca',
  'correction buy',
]

export default function TagInput({
  tags,
  onChange,
  suggestions = DEFAULT_SUGGESTIONS,
  placeholder = 'Add tags...',
  maxTags = 5,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputValue.trim()) {
      const filtered = suggestions.filter(
        (s) =>
          s.toLowerCase().includes(inputValue.toLowerCase()) &&
          !tags.includes(s)
      )
      setFilteredSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
    } else {
      setFilteredSuggestions([])
      setShowSuggestions(false)
    }
  }, [inputValue, suggestions, tags])

  const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (trimmed && !tags.includes(trimmed) && tags.length < maxTags) {
      onChange([...tags, trimmed])
      setInputValue('')
      setShowSuggestions(false)
    }
  }

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter((t) => t !== tagToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredSuggestions.length > 0) {
        const firstSuggestion = filteredSuggestions[0]
        if (firstSuggestion) {
          addTag(firstSuggestion)
        }
      } else if (inputValue.trim()) {
        addTag(inputValue)
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      const lastTag = tags[tags.length - 1]
      if (lastTag) {
        removeTag(lastTag)
      }
    }
  }

  return (
    <div className="field" style={{ position: 'relative' }}>
      <label>Tags</label>
      <div
        className="input"
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, minHeight: 38, height: 'auto' }}
      >
        {tags.map((tag) => (
          <Tag key={tag} label={tag} onRemove={() => removeTag(tag)} variant="primary" />
        ))}
        {tags.length < maxTags && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => inputValue && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder={tags.length === 0 ? placeholder : ''}
            style={{ flex: 1, minWidth: 120, border: 'none', outline: 'none', background: 'transparent', padding: 0, font: 'inherit', color: 'inherit' }}
          />
        )}
      </div>

      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          style={{
            position: 'absolute', zIndex: 10, marginTop: 4, width: '100%',
            background: 'var(--color-surface)', border: '1px solid var(--color-divider)',
            boxShadow: 'var(--elev-md)', maxHeight: 192, overflow: 'auto',
          }}
        >
          {filteredSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => addTag(suggestion)}
              className="btn-ghost"
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 13 }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {tags.length >= maxTags ? (
        <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>Maximum {maxTags} tags reached</p>
      ) : (
        <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>Press Enter to add a tag, or select from suggestions</p>
      )}
    </div>
  )
}
