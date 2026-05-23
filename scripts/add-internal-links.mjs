/**
 * add-internal-links.mjs
 *
 * Scans all markdown articles and inserts internal links for the first
 * occurrence of key destination/city names (max MAX_LINKS per article).
 *
 * Rules:
 *  - Never link inside existing [text](url), code blocks, or frontmatter
 *  - Never link a keyword already used in this article (first-occurrence only)
 *  - Never self-link
 *  - Max MAX_LINKS injected links per article
 *  - Only link plain body text (after frontmatter separator)
 *  - Keyword match is whole-word, case-insensitive
 *
 * Usage: node scripts/add-internal-links.mjs [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'src/content');
const DRY_RUN = process.argv.includes('--dry-run');
const MAX_LINKS = 8; // max internal links injected per article

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split('\n')) {
    const [k, ...rest] = line.split(':');
    if (k && rest.length) fm[k.trim()] = rest.join(':').trim().replace(/^["']|["']$/g, '');
  }
  return fm;
}

function toDestSlug(dest) {
  return dest.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Build keyword → URL maps ──────────────────────────────────────────────────
// Returns TWO maps:
//   globalMap  — keywords safe to inject in ANY article (destination names, seasonal phrases)
//   localMaps  — per-destSlug map of city/topic keywords (only injected in same-dest articles)

function buildKeywordMaps(articles) {
  const globalMap = new Map();
  const localMaps = new Map(); // destSlug → Map<keyword, {url, priority}>

  for (const a of articles) {
    const url = `/${a.destSlug}/${a.slug}`;
    if (!localMaps.has(a.destSlug)) localMaps.set(a.destSlug, new Map());
    const local = localMaps.get(a.destSlug);

    // --- City guides (LOCAL only — avoid cross-destination false matches) ---
    const cityMatch = a.slug.match(/^([a-z-]+?)(?:-travel)?-guide$/);
    if (cityMatch) {
      const cityRaw = cityMatch[1].replace(/-/g, ' ');
      addKeyword(local, cityRaw, url, 1);
    }

    // --- Destination hub → destination name (GLOBAL — cross-destination links) ---
    if (a.slug.includes('first-timers') || a.slug.includes('first-time')) {
      addKeyword(globalMap, a.destination, `/${a.destSlug}`, 2);
    }

    // --- Best time to visit (GLOBAL phrase match) ---
    if (a.slug.includes('best-time')) {
      addKeyword(globalMap, `best time to visit ${a.destination}`, url, 2);
      addKeyword(globalMap, `when to visit ${a.destination}`, url, 2);
    }

    // --- Itinerary articles (LOCAL) ---
    const itin = a.slug.match(/^(\d+)[-]?(day|week|days|weeks)/i);
    if (itin && a.category === 'Itinerary') {
      const duration = `${itin[1]} ${itin[2]}`;
      addKeyword(local, `${duration} itinerary`, url, 3);
      addKeyword(local, `${duration} in ${a.destination}`, url, 3);
    }

    // --- Seasonal articles (GLOBAL phrase match — unambiguous) ---
    const monthMatch = a.slug.match(/-(january|february|march|april|may|june|july|august|september|october|november|december)$/);
    if (monthMatch) {
      const month = monthMatch[1];
      addKeyword(globalMap, `${a.destination} in ${month}`, url, 3);
      addKeyword(globalMap, `visiting ${a.destination} in ${month}`, url, 3);
    }
  }

  return { globalMap, localMaps };
}

function addKeyword(map, raw, url, priority) {
  const key = raw.toLowerCase().trim();
  if (!key || key.length < 3) return;
  const existing = map.get(key);
  if (!existing || existing.priority > priority) {
    map.set(key, { url, priority, label: raw });
  }
}

// ── Inject links into body text ───────────────────────────────────────────────

function injectLinks(body, keywordMap, selfUrl) {
  let linkCount = 0;
  const used = new Set(); // keywords already linked in this article

  // Step 1: protect segments we must NOT modify
  const protected_ = [];
  let text = body;

  const protect = (regex) => {
    text = text.replace(regex, (match) => {
      protected_.push(match);
      return `\x00P${protected_.length - 1}\x00`;
    });
  };

  protect(/```[\s\S]*?```/g);         // fenced code blocks
  protect(/`[^`\n]+`/g);              // inline code
  protect(/\[([^\]]+)\]\([^)]+\)/g);  // existing MD links [text](url)
  protect(/!\[([^\]]*)\]\([^)]+\)/g); // images ![alt](url)
  protect(/^#{1,6} .+$/gm);           // headings — don't link inside headings
  protect(/^> .+$/gm);                // blockquotes

  // Step 2: build sorted keyword list (longest first to avoid partial matches)
  const keywords = [...keywordMap.entries()]
    .sort((a, b) => b[0].length - a[0].length);

  // Step 3: inject links
  for (const [keyword, { url }] of keywords) {
    if (linkCount >= MAX_LINKS) break;
    if (used.has(keyword)) continue;
    if (url === selfUrl) continue;

    const regex = new RegExp(`(?<![\\[\\w])\\b(${escapeRegex(keyword)})\\b(?![\\]\\w])`, 'i');
    const before = text;
    text = text.replace(regex, (match) => {
      if (linkCount >= MAX_LINKS) return match;
      linkCount++;
      used.add(keyword);
      return `[${match}](${url})`;
    });
    // Only count first replacement (replace() with non-global regex does one)
    if (text === before) used.delete(keyword); // didn't match, free the slot
  }

  // Step 4: restore protected segments
  text = text.replace(/\x00P(\d+)\x00/g, (_, i) => protected_[parseInt(i)]);

  return { text, linkCount };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'WRITE'}\n`);

  // Load all articles
  const articles = [];
  for (const dest of fs.readdirSync(CONTENT_DIR)) {
    const destDir = path.join(CONTENT_DIR, dest);
    if (!fs.statSync(destDir).isDirectory()) continue;
    for (const file of fs.readdirSync(destDir)) {
      if (!file.endsWith('.md')) continue;
      const fullPath = path.join(destDir, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      const fm = parseFrontmatter(content);
      const slug = file.replace('.md', '');
      const destination = fm.destination || dest;
      const destSlug = toDestSlug(destination);
      articles.push({ file, dest, slug, destination, destSlug, fullPath, content, category: fm.category || '' });
    }
  }

  console.log(`Loaded ${articles.length} articles`);

  // Build keyword maps
  const { globalMap, localMaps } = buildKeywordMaps(articles);
  console.log(`Global keyword map: ${globalMap.size} entries`);
  console.log(`Local maps: ${localMaps.size} destinations`);

  if (DRY_RUN) {
    let shown = 0;
    console.log('\nSample global keywords:');
    for (const [kw, { url, priority }] of [...globalMap.entries()].sort((a, b) => a[1].priority - b[1].priority)) {
      if (shown++ > 20) break;
      console.log(`  [p${priority}] "${kw}" → ${url}`);
    }
    console.log('\nSample local keywords (japan):');
    let jShown = 0;
    for (const [kw, { url }] of (localMaps.get('japan') || new Map())) {
      if (jShown++ > 15) break;
      console.log(`  "${kw}" → ${url}`);
    }
  }

  // Process each article
  let totalModified = 0;
  let totalLinks = 0;

  for (const article of articles) {
    const selfUrl = `/${article.destSlug}/${article.slug}`;

    // Merge global + local keyword maps for this article's destination
    const merged = new Map([...globalMap, ...(localMaps.get(article.destSlug) || new Map())]);

    // Split frontmatter from body
    const fmEnd = article.content.indexOf('\n---\n', 4);
    if (fmEnd === -1) continue;
    const frontmatter = article.content.slice(0, fmEnd + 5);
    const body = article.content.slice(fmEnd + 5);

    const { text: newBody, linkCount } = injectLinks(body, merged, selfUrl);

    if (linkCount === 0) continue;

    const newContent = frontmatter + newBody;
    totalLinks += linkCount;
    totalModified++;

    if (DRY_RUN) {
      console.log(`\n[DRY] ${article.dest}/${article.file} (+${linkCount} links)`);
      // Show first diff
      const bodyLines = body.split('\n');
      const newLines = newBody.split('\n');
      for (let i = 0; i < bodyLines.length; i++) {
        if (bodyLines[i] !== newLines[i]) {
          console.log(`  - ${bodyLines[i].slice(0, 100)}`);
          console.log(`  + ${newLines[i].slice(0, 100)}`);
          break;
        }
      }
    } else {
      fs.writeFileSync(article.fullPath, newContent, 'utf8');
      if (totalModified % 50 === 0) process.stdout.write(`  ${totalModified} files modified...\n`);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Modified: ${totalModified} articles`);
  console.log(`🔗 Links injected: ${totalLinks}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

main().catch(console.error);
