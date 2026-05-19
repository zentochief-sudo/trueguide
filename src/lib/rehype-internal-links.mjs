/**
 * rehype-internal-links
 *
 * Auto-links first mention of destination and city names to their hub pages.
 * Runs at build time — no runtime JS. Skips text already inside <a> or headings.
 */

import { visit } from 'unist-util-visit';

const DEST_MAP = [
  ['South Korea', '/korea'],
  ['Costa Rica', '/costa-rica'],
  ['United States', '/usa'],
  ['Japan', '/japan'],
  ['Korea', '/korea'],
  ['Canada', '/canada'],
  ['Egypt', '/egypt'],
  ['France', '/france'],
  ['Spain', '/spain'],
  ['Italy', '/italy'],
  ['Portugal', '/portugal'],
  ['Ireland', '/ireland'],
  ['India', '/india'],
  ['Thailand', '/thailand'],
  ['Malaysia', '/malaysia'],
  ['Peru', '/peru'],
  ['Tanzania', '/tanzania'],
  ['Pakistan', '/pakistan'],
  ['Kazakhstan', '/kazakhstan'],
  ['Greenland', '/greenland'],
  ['Mexico', '/mexico'],
  ['USA', '/usa'],
];

const CITY_MAP = [
  ['Chiang Mai', '/thailand'],
  ['Kuala Lumpur', '/malaysia'],
  ['Mexico City', '/mexico'],
  ['Tokyo', '/japan'],
  ['Kyoto', '/japan'],
  ['Osaka', '/japan'],
  ['Hiroshima', '/japan'],
  ['Kanazawa', '/japan'],
  ['Hokkaido', '/japan'],
  ['Fukuoka', '/japan'],
  ['Hakone', '/japan'],
  ['Seoul', '/korea'],
  ['Busan', '/korea'],
  ['Gyeongju', '/korea'],
  ['Bangkok', '/thailand'],
  ['Penang', '/malaysia'],
  ['Paris', '/france'],
  ['Barcelona', '/spain'],
  ['Madrid', '/spain'],
  ['Rome', '/italy'],
  ['Milan', '/italy'],
  ['Venice', '/italy'],
  ['Lisbon', '/portugal'],
  ['Porto', '/portugal'],
  ['Dublin', '/ireland'],
  ['Cairo', '/egypt'],
  ['Lima', '/peru'],
  ['Cusco', '/peru'],
  ['Almaty', '/kazakhstan'],
  ['Zanzibar', '/tanzania'],
  ['Lahore', '/pakistan'],
  ['Islamabad', '/pakistan'],
  ['Vancouver', '/canada'],
  ['Toronto', '/canada'],
  ['Oaxaca', '/mexico'],
];

// Longer phrases first to avoid partial matches (e.g. "South Korea" before "Korea")
const ALL_KEYWORDS = [...DEST_MAP, ...CITY_MAP].sort((a, b) => b[0].length - a[0].length);

function getDestinationFromPath(path) {
  if (!path) return null;
  const match = path.match(/src\/content\/([^/]+)\//);
  return match ? match[1] : null;
}

function makeLink(matched, href) {
  return {
    type: 'element',
    tagName: 'a',
    properties: { href, className: ['internal-link'] },
    children: [{ type: 'text', value: matched }],
  };
}

function splitText(text, keyword, href) {
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return null;

  // Word boundary check
  const before = idx > 0 ? text[idx - 1] : ' ';
  const after = idx + keyword.length < text.length ? text[idx + keyword.length] : ' ';
  if (/[a-zA-Z]/.test(before) || /[a-zA-Z]/.test(after)) return null;

  const nodes = [];
  if (idx > 0) nodes.push({ type: 'text', value: text.slice(0, idx) });
  nodes.push(makeLink(text.slice(idx, idx + keyword.length), href));
  const rest = text.slice(idx + keyword.length);
  if (rest) nodes.push({ type: 'text', value: rest });
  return nodes;
}

export function rehypeInternalLinks() {
  return function (tree, file) {
    const currentDest = getDestinationFromPath(file?.history?.[0] ?? '');

    // Keywords excluding this page's own destination
    const keywords = ALL_KEYWORDS.filter(([, href]) => {
      if (!currentDest) return true;
      const destFromHref = href.split('/')[1];
      return destFromHref !== currentDest;
    });

    const linked = new Set();

    // Walk with ancestor tracking to detect <a> and heading parents
    function walk(node, ancestors) {
      if (node.type === 'text' && node.value.trim()) {
        const inAnchor = ancestors.some((n) => n.type === 'element' && n.tagName === 'a');
        const inHeading = ancestors.some((n) => n.type === 'element' && /^h[1-6]$/.test(n.tagName));

        if (!inAnchor && !inHeading) {
          const parent = ancestors[ancestors.length - 1];
          const idx = parent?.children?.indexOf(node);

          if (parent && idx !== undefined && idx !== -1) {
            for (const [keyword, href] of keywords) {
              if (linked.has(keyword)) continue;
              const parts = splitText(node.value, keyword, href);
              if (parts) {
                parent.children.splice(idx, 1, ...parts);
                linked.add(keyword);
                // Walk the non-link parts we just inserted (text nodes before/after)
                for (const part of parts) {
                  if (part.type === 'text') walk(part, ancestors);
                }
                return;
              }
            }
          }
        }
      }

      if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
          walk(node.children[i], [...ancestors, node]);
        }
      }
    }

    walk(tree, []);
  };
}
