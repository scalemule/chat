import React, { useState, useCallback } from 'react';

import { useSearch } from '../react';
import type { ChatMessage } from '../types';
import type { ChatTheme } from './theme';
import { themeToStyle } from './theme';
import { SearchResults } from './SearchResults';

interface SearchBarProps {
  conversationId: string;
  theme?: ChatTheme;
  placeholder?: string;
  onResultSelect?: (message: ChatMessage) => void;
}

export function SearchBar({
  conversationId,
  theme,
  placeholder = 'Search messages...',
  onResultSelect,
}: SearchBarProps): React.JSX.Element {
  const [input, setInput] = useState('');
  const { results, total, query, isSearching, search, clearSearch } = useSearch(conversationId);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (input.trim()) {
        void search(input.trim());
      }
    },
    [input, search],
  );

  const handleClear = useCallback(() => {
    setInput('');
    clearSearch();
  }, [clearSearch]);

  return (
    <div data-scalemule-chat="" style={{ ...themeToStyle(theme), fontFamily: 'var(--sm-font-family)' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1,
            borderRadius: 12,
            border: '1px solid var(--sm-border-color, #e5e7eb)',
            padding: '8px 12px',
            font: 'inherit',
            fontSize: 14,
          }}
        />
        {query ? (
          <button
            type="button"
            onClick={handleClear}
            style={{
              border: '1px solid var(--sm-border-color, #e5e7eb)',
              background: 'transparent',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
              cursor: 'pointer',
              color: 'var(--sm-muted-text, #6b7280)',
            }}
          >
            Clear
          </button>
        ) : null}
      </form>
      {query ? (
        <SearchResults
          results={results}
          total={total}
          query={query}
          isSearching={isSearching}
          theme={theme}
          onSelect={onResultSelect}
        />
      ) : null}
    </div>
  );
}
