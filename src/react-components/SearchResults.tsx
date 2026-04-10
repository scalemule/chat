import React from 'react';

import type { ChatMessage, ChatSearchResult } from '../types';
import type { ChatTheme } from './theme';
import { themeToStyle } from './theme';

interface SearchResultsProps {
  results: ChatSearchResult[];
  total: number;
  query: string;
  isSearching: boolean;
  theme?: ChatTheme;
  onSelect?: (message: ChatMessage) => void;
}

function highlightText(text: string, highlights: string[]): React.JSX.Element {
  if (!highlights.length) {
    return <>{text}</>;
  }
  // Use the first highlight as the display excerpt
  const excerpt = highlights[0];
  // Highlights from OpenSearch use <em> tags — render as bold
  const parts = excerpt.split(/<\/?em>/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} style={{ background: 'rgba(37, 99, 235, 0.15)', borderRadius: 2, padding: '0 2px' }}>
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function SearchResults({
  results,
  total,
  query,
  isSearching,
  theme,
  onSelect,
}: SearchResultsProps): React.JSX.Element {
  return (
    <div
      data-scalemule-chat=""
      style={{
        ...themeToStyle(theme),
        marginTop: 8,
        borderRadius: 'var(--sm-border-radius, 16px)',
        border: '1px solid var(--sm-border-color, #e5e7eb)',
        background: 'var(--sm-surface, #fff)',
        fontFamily: 'var(--sm-font-family)',
        overflow: 'hidden',
        maxHeight: 400,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--sm-border-color, #e5e7eb)',
          fontSize: 12,
          color: 'var(--sm-muted-text, #6b7280)',
        }}
      >
        {isSearching
          ? 'Searching...'
          : `${total} result${total === 1 ? '' : 's'} for "${query}"`}
      </div>

      {!isSearching && !results.length ? (
        <div style={{ padding: 24, fontSize: 14, color: 'var(--sm-muted-text, #6b7280)', textAlign: 'center' }}>
          No results found
        </div>
      ) : (
        results.map((result) => (
          <button
            key={result.message.id}
            type="button"
            onClick={() => onSelect?.(result.message)}
            style={{
              width: '100%',
              border: 'none',
              borderBottom: '1px solid var(--sm-border-color, #e5e7eb)',
              padding: '12px 16px',
              textAlign: 'left',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sm-text-color, #111827)' }}>
                {result.message.sender_id.substring(0, 8)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--sm-muted-text, #6b7280)' }}>
                {new Date(result.message.created_at).toLocaleDateString()}
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--sm-text-color, #111827)', lineHeight: 1.4 }}>
              {highlightText(result.message.content, result.highlights)}
            </div>
          </button>
        ))
      )}
    </div>
  );
}
