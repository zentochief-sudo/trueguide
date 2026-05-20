/**
 * download-hero-images.mjs
 *
 * Downloads hero images from Unsplash for all articles that are missing one.
 * Uses batch requests (count=30) to stay within the 50 req/hour demo limit.
 *
 * Usage: node scripts/download-hero-images.mjs
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'src/content');
const IMAGES_DIR = path.join(ROOT, 'public/images');
const ACCESS_KEY = '56Tztq0rvkgE5uOFdVcY727DQVeEkL-BCtEZbdcMBac';

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(httpsGet(res.headers.location, headers));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
  });
}

async function unsplashBatch(query, count = 30) {
  const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&count=${count}&orientation=landscape&content_filter=high`;
  const { status, body } = await httpsGet(url, {
    Authorization: `Client-ID ${ACCESS_KEY}`,
  });
  if (status !== 200) {
    console.error(`  Unsplash error ${status} for query "${query}": ${body.toString().slice(0,200)}`);
    return [];
  }
  return JSON.parse(body.toString());
}

async function downloadImage(downloadUrl, destPath) {
  const { status, body } = await httpsGet(downloadUrl);
  if (status !== 200) {
    console.error(`  Download failed (${status}): ${downloadUrl.slice(0, 80)}`);
    return false;
  }
  fs.writeFileSync(destPath, body);
  return true;
}

// ── Parse all markdown files ─────────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) {
      fm[key.trim()] = rest.join(':').trim().replace(/^["']|["']$/g, '');
    }
  }
  return fm;
}

function getAllArticles() {
  const articles = [];
  for (const dest of fs.readdirSync(CONTENT_DIR)) {
    const destDir = path.join(CONTENT_DIR, dest);
    if (!fs.statSync(destDir).isDirectory()) continue;
    for (const file of fs.readdirSync(destDir)) {
      if (!file.endsWith('.md')) continue;
      const content = fs.readFileSync(path.join(destDir, file), 'utf8');
      const fm = parseFrontmatter(content);
      if (!fm.heroImage) continue;
      articles.push({
        file,
        destination: fm.destination || dest,
        title: fm.title || '',
        heroImage: fm.heroImage.trim(), // e.g. /images/japan-2weeks-hero.jpg
        imageName: path.basename(fm.heroImage.trim()), // e.g. japan-2weeks-hero.jpg
      });
    }
  }
  return articles;
}

// ── Build search query from article title + destination ──────────────────────

function buildQuery(title, destination) {
  const t = title.toLowerCase();

  // Topic keywords → Unsplash search hints
  const topicMap = [
    [/food|eat|restaurant|cuisine|dish|ramen|sushi|street food|market/i, 'food'],
    [/night|bar|club|nightlife|drinks/i, 'nightlife'],
    [/temple|shrine|palace|castle|heritage|historic|ancient/i, 'temple architecture'],
    [/nature|hike|hiking|mountain|waterfall|forest|jungle|wildlife/i, 'nature landscape'],
    [/beach|island|coast|sea|ocean|surf/i, 'beach'],
    [/budget|cheap|cost|money|backpack/i, 'travel'],
    [/itinerary|days?|weeks?|trip/i, 'travel'],
    [/transport|train|metro|airport|bus|flight/i, 'travel transport'],
    [/neighborhood|district|area|quarter/i, 'city street'],
    [/onsen|hot spring|bath/i, 'hot spring spa'],
    [/art|museum|gallery|culture/i, 'art museum'],
    [/festival|cherry blossom|sakura|autumn|foliage/i, 'seasonal nature'],
    [/hotel|hostel|accommodation|stay/i, 'hotel'],
    [/world cup|stadium|soccer|football/i, 'stadium'],
    [/garden|park/i, 'garden park'],
  ];

  let topic = 'travel';
  for (const [re, t] of topicMap) {
    if (re.test(title)) { topic = t; break; }
  }

  return `${destination} ${topic} photography`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  const articles = getAllArticles();
  console.log(`Total articles: ${articles.length}`);

  // Filter to only missing images
  const missing = articles.filter(a => {
    const dest = path.join(IMAGES_DIR, a.imageName);
    return !fs.existsSync(dest);
  });
  console.log(`Missing images: ${missing.length}`);

  if (missing.length === 0) {
    console.log('All images already downloaded!');
    return;
  }

  // Group by DESTINATION only — minimise API calls (1 per destination)
  const groups = new Map();
  for (const article of missing) {
    const dest = article.destination;
    if (!groups.has(dest)) groups.set(dest, []);
    groups.get(dest).push(article);
  }

  console.log(`Destination groups: ${groups.size}`);
  console.log(`Estimated Unsplash API calls: ~${groups.size * 2} (fetching 30 photos/call)`);
  console.log('Rate limit: pausing 80s between every API call to stay under 50/hour');
  console.log('');

  let totalDownloaded = 0;
  let totalFailed = 0;
  let apiCallCount = 0;

  for (const [dest, articlesInGroup] of groups) {
    const query = `${dest} travel landscape photography`;
    console.log(`\n[${dest}] — ${articlesInGroup.length} articles`);

    // Fetch enough photos for the whole destination (max 30 per call)
    let photoPool = [];
    let needed = articlesInGroup.length;
    while (photoPool.length < needed) {
      const batchSize = Math.min(30, needed - photoPool.length);
      console.log(`  → Fetching ${batchSize} photos (call #${apiCallCount + 1})...`);

      // Rate limit: 80 seconds between EVERY call (= 45/hour safely under 50)
      if (apiCallCount > 0) {
        process.stdout.write('  ⏳ Rate limit pause (80s)... ');
        await sleep(80_000);
        console.log('done');
      }

      const photos = await unsplashBatch(query, batchSize);
      apiCallCount++;

      if (photos.length === 0) {
        console.log(`  ⚠ No photos returned, skipping remaining`);
        break;
      }
      photoPool.push(...photos);
    }

    if (photoPool.length === 0) {
      console.log(`  ⚠ No photos returned for query, skipping group`);
      totalFailed += articlesInGroup.length;
      continue;
    }

    // Assign photos round-robin
    for (let i = 0; i < articlesInGroup.length; i++) {
      const article = articlesInGroup[i];
      const photo = photoPool[i % photoPool.length];
      const destPath = path.join(IMAGES_DIR, article.imageName);

      const downloadUrl = photo.urls?.regular;
      if (!downloadUrl) {
        console.log(`  ✗ No URL for ${article.imageName}`);
        totalFailed++;
        continue;
      }

      process.stdout.write(`  ↓ ${article.imageName} ... `);
      const ok = await downloadImage(downloadUrl, destPath);
      if (ok) {
        console.log(`✓ (${Math.round(fs.statSync(destPath).size / 1024)}KB)`);
        totalDownloaded++;
      } else {
        totalFailed++;
      }

      // Trigger Unsplash download event (required by API guidelines)
      if (photo.links?.download_location) {
        httpsGet(photo.links.download_location, {
          Authorization: `Client-ID ${ACCESS_KEY}`,
        }).catch(() => {});
      }

      // Small delay between file writes
      await sleep(100);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Downloaded: ${totalDownloaded}`);
  console.log(`❌ Failed:     ${totalFailed}`);
  console.log(`📡 API calls:  ${apiCallCount}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(console.error);
