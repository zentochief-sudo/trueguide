/**
 * rehype-ad-inject
 *
 * Injects an inline ad slot before every Nth <h2> in article prose.
 * Runs at build time as a rehype plugin — no runtime JS, pure HTML output.
 *
 * Default: before every 2nd H2 (i.e., before H2 #2, #4, #6…)
 * → A 6-section article gets ~3 ads. A 4-section article gets ~2 ads.
 *
 * The injected div uses the same .ad-slot classes as AdSlot.astro so the
 * global.css styles apply automatically. No scoping issues.
 *
 * To activate AdSense: swap the placeholder div for <ins class="adsbygoogle">
 * in makeAdNode() below, same as in AdSlot.astro.
 */

import { visit } from 'unist-util-visit';

function makeAdNode() {
  return {
    type: 'element',
    tagName: 'div',
    properties: {
      className: ['ad-slot', 'ad-slot--inline-feed'],
      'data-ad-placeholder': '',
      ariaHidden: 'true',
    },
    children: [
      {
        type: 'element',
        tagName: 'span',
        properties: { className: ['ad-slot-label'] },
        children: [{ type: 'text', value: 'Advertisement' }],
      },
    ],
  };
}

/**
 * @param {{ every?: number }} options
 *   every: insert ad before every Nth h2 (default 2 → before 2nd, 4th, 6th…)
 */
export function rehypeAdInject({ every = 2 } = {}) {
  return function (tree) {
    // Collect all h2 positions (parent ref + index) in document order
    const h2s = [];

    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName === 'h2' && parent && typeof index === 'number') {
        h2s.push({ parent, index });
      }
    });

    // Insert ad before every Nth h2 (0-indexed: positions 1, 3, 5… for every=2)
    // Work in reverse so earlier splices don't shift later indices.
    h2s
      .filter((_, i) => (i + 1) % every === 0)
      .reverse()
      .forEach(({ parent, index }) => {
        parent.children.splice(index, 0, makeAdNode());
      });
  };
}
