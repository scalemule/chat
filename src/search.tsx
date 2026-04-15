/**
 * `@scalemule/chat/search` — opt-in search UX for chat hosts.
 *
 * Code-split entry. Hosts that don't render the search panel / dropdown
 * never pull this code into the core `react.js` bundle. The only
 * dependency is React.
 *
 * Typical wiring (0.0.53 surface):
 *
 * ```tsx
 * import {
 *   HighlightedExcerpt,
 *   SearchHistoryDropdown,
 *   useSearchHistory,
 * } from '@scalemule/chat/search';
 *
 * const { history, push, clear } = useSearchHistory();
 *
 * <input
 *   value={q}
 *   onChange={(e) => setQ(e.target.value)}
 *   onFocus={() => setOpen(true)}
 *   onKeyDown={(e) => {
 *     if (e.key === 'Enter') {
 *       push(q);
 *       setOpen(false);
 *     }
 *   }}
 * />
 * {open && (
 *   <SearchHistoryDropdown
 *     history={history}
 *     onSelect={(q) => { setQ(q); setOpen(false); }}
 *     onClose={() => setOpen(false)}
 *     onClear={clear}
 *   />
 * )}
 * ```
 *
 * Cross-conversation search (`useGlobalSearch`) + the overlay panel
 * ship in 0.0.54.
 */

export { HighlightedExcerpt } from './search/HighlightedExcerpt';
export type { HighlightedExcerptProps } from './search/HighlightedExcerpt';

export { SearchHistoryDropdown } from './search/SearchHistoryDropdown';
export type { SearchHistoryDropdownProps } from './search/SearchHistoryDropdown';

export { useSearchHistory } from './search/useSearchHistory';
export type {
  SearchHistory,
  SearchHistoryOptions,
} from './search/useSearchHistory';

export { useGlobalSearch } from './search/useGlobalSearch';
export type {
  GlobalSearch,
  GlobalSearchOptions,
  GlobalSearchProgress,
  GlobalSearchError,
} from './search/useGlobalSearch';

export { SearchResultsPanel } from './search/SearchResultsPanel';
export type {
  SearchResultsPanelProps,
  SearchResultsPanelProfile,
  SearchResultsPanelRowContext,
} from './search/SearchResultsPanel';

// GlobalSearchResult lives on the core types so hosts that don't import
// `/search` can still reference the annotated shape (e.g. in server
// code that produces results before rendering).
export type { GlobalSearchResult } from './types';

// Pure helper — also exposed so hosts can render excerpts outside of
// this entry's React components (e.g. a custom row renderer).
export { sanitizeSearchExcerpt } from './shared/searchExcerpt';
