import React, { useMemo } from 'react';

import { sanitizeSearchExcerpt } from '../shared/searchExcerpt';

export interface HighlightedExcerptProps {
  /** Raw excerpt HTML from `ChatSearchResult.highlights[i]`. */
  html: string;
  /**
   * Additional class names merged onto the span. The `.sm-search-result-excerpt`
   * hook is always present so host CSS can style highlights via
   * `.sm-search-result-excerpt em` / `.sm-search-result-excerpt mark`.
   */
  className?: string;
}

/**
 * Safely render a search-result excerpt that may contain `<em>` or
 * `<mark>` highlight tags. Untrusted markup is stripped via
 * `sanitizeSearchExcerpt` before reaching the DOM.
 */
export function HighlightedExcerpt({
  html,
  className,
}: HighlightedExcerptProps): React.JSX.Element {
  const safe = useMemo(() => sanitizeSearchExcerpt(html), [html]);
  const cls = className
    ? `sm-search-result-excerpt ${className}`
    : 'sm-search-result-excerpt';
  return (
    <span
      className={cls}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
