// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { HighlightedExcerpt } from '../HighlightedExcerpt';

describe('HighlightedExcerpt', () => {
  it('renders <em> markup from the backend', () => {
    const { container } = render(
      <HighlightedExcerpt html="hello <em>world</em>" />,
    );
    const em = container.querySelector('.sm-search-result-excerpt em');
    expect(em?.textContent).toBe('world');
  });

  it('renders <mark> markup (forward-compat)', () => {
    const { container } = render(
      <HighlightedExcerpt html="see <mark>match</mark>" />,
    );
    const mark = container.querySelector('.sm-search-result-excerpt mark');
    expect(mark?.textContent).toBe('match');
  });

  it('strips <script> from adversarial input', () => {
    const { container } = render(
      <HighlightedExcerpt html='ok <script>alert(1)</script> done' />,
    );
    expect(container.querySelector('script')).toBeNull();
  });

  it('strips attributes from allowed tags', () => {
    const { container } = render(
      <HighlightedExcerpt html='<em onclick="x" class="y">hi</em>' />,
    );
    const em = container.querySelector('em');
    expect(em).toBeTruthy();
    expect(em?.getAttribute('onclick')).toBeNull();
    expect(em?.getAttribute('class')).toBeNull();
  });

  it('renders an empty span for empty input', () => {
    const { container } = render(<HighlightedExcerpt html="" />);
    const span = container.querySelector('.sm-search-result-excerpt');
    expect(span?.innerHTML).toBe('');
  });

  it('merges caller-supplied className', () => {
    const { container } = render(
      <HighlightedExcerpt html="hi <em>x</em>" className="custom" />,
    );
    const span = container.querySelector('span');
    expect(span?.className).toContain('sm-search-result-excerpt');
    expect(span?.className).toContain('custom');
  });
});
