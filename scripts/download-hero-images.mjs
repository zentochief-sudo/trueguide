/**
 * download-hero-images.mjs
 *
 * Downloads hero images from Unsplash for all articles missing one.
 * - Groups articles by destination → 1 Unsplash API call per destination group
 * - Downloads images in parallel (CDN has no rate limit)
 * - Waits 75s between Unsplash API metadata calls (50/hour limit)
 * - Automatically converts each JPG to WebP at quality 82
 *
 * Usage: node scripts/download-hero-images.mjs
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'src/content');
const IMAGES_DIR = path.join(ROOT, 'public/images');
const ACCESS_KEY = '56Tztq0rvkgE5uOFdVcY727DQVeEkL-BCtEZbdcMBac';

// Concurrency for parallel image downloads
const DOWNLOAD_CONCURRENCY = 8;

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
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function unsplashBatch(query, count = 30) {
  const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&count=${count}&orientation=landscape&content_filter=high`;
  const { status, body } = await httpsGet(url, {
    Authorization: `Client-ID ${ACCESS_KEY}`,
  });
  if (status !== 200) {
    console.error(`  Unsplash error ${status} for "${query}": ${body.toString().slice(0, 200)}`);
    return [];
  }
  return JSON.parse(body.toString());
}

async function downloadImage(downloadUrl, destPath) {
  try {
    const { status, body } = await httpsGet(downloadUrl);
    if (status !== 200) return false;
    fs.writeFileSync(destPath, body);
    return true;
  } catch {
    return false;
  }
}

// Run cwebp if available; skip silently if not
function toWebp(jpgPath) {
  const webpPath = jpgPath.replace(/\.(jpe?g|png)$/i, '.webp');
  if (fs.existsSync(webpPath)) return;
  try {
    execSync(`cwebp -q 82 "${jpgPath}" -o "${webpPath}"`, { stdio: 'ignore' });
  } catch { /* cwebp not installed — skip */ }
}

// Run N promises with max concurrency
async function withConcurrency(items, concurrency, fn) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
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
        heroImage: fm.heroImage.trim(),
        imageName: path.basename(fm.heroImage.trim()),
      });
    }
  }
  return articles;
}

function buildQuery(destination, articleSample) {
  // Use destination + generic travel — gets landscape photos for that country/city
  const d = destination.toLowerCase();

  // Seasonal articles: use landscape/travel
  if (articleSample.some(a => /in (january|february|march|april|may|june|july|august|september|october|november|december)/i.test(a.title))) {
    return `${destination} landscape travel photography`;
  }
  return `${destination} travel photography`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  const articles = getAllArticles();
  console.log(`Total articles: ${articles.length}`);

  const missing = articles.filter(a => !fs.existsSync(path.join(IMAGES_DIR, a.imageName)));
  console.log(`Missing images: ${missing.length}`);

  if (missing.length === 0) {
    console.log('✅ All images already downloaded!');
    return;
  }

  // Group by destination
  const groups = new Map();
  for (const article of missing) {
    const key = article.destination;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(article);
  }

  console.log(`Destination groups: ${groups.size}`);
  console.log(`Parallel downloads: ${DOWNLOAD_CONCURRENCY} concurrent`);
  console.log('Rate limit: 75s between Unsplash API calls\n');

  let totalDownloaded = 0;
  let totalFailed = 0;
  let apiCallCount = 0;

  for (const [dest, articlesInGroup] of groups) {
    console.log(`\n[${dest}] — ${articlesInGroup.length} articles`);

    // Pool photos across multiple batches if needed
    let photoPool = [];
    const needed = articlesInGroup.length;

    while (photoPool.length < needed) {
      const batchSize = Math.min(30, needed - photoPool.length);

      if (apiCallCount > 0) {
        process.stdout.write(`  ⏳ Rate limit pause (75s)... `);
        await sleep(75_000);
        console.log('done');
      }

      const query = buildQuery(dest, articlesInGroup);
      console.log(`  → Unsplash API call #${apiCallCount + 1}: "${query}" (${batchSize} photos)`);
      const photos = await unsplashBatch(query, batchSize);
      apiCallCount++;

      if (photos.length === 0) {
        console.log(`  ⚠ No photos returned`);
        break;
      }
      photoPool.push(...photos);
    }

    if (photoPool.length === 0) {
      console.log(`  ⚠ Skipping — no photos available`);
      totalFailed += articlesInGroup.length;
      continue;
    }

    // Prepare download tasks
    const tasks = articlesInGroup.map((article, i) => ({
      article,
      photo: photoPool[i % photoPool.length],
    }));

    // Download in parallel
    const results = await withConcurrency(tasks, DOWNLOAD_CONCURRENCY, async ({ article, photo }) => {
      const destPath = path.join(IMAGES_DIR, article.imageName);
      const downloadUrl = photo.urls?.regular;

      if (!downloadUrl) {
        console.log(`  ✗ ${article.imageName} — no URL`);
        return false;
      }

      const ok = await downloadImage(downloadUrl, destPath);
      if (ok) {
        const kb = Math.round(fs.statSync(destPath).size / 1024);
        console.log(`  ✓ ${article.imageName} (${kb}KB)`);
        // Trigger Unsplash download event (API guidelines)
        if (photo.links?.download_location) {
          httpsGet(photo.links.download_location, {
            Authorization: `Client-ID ${ACCESS_KEY}`,
          }).catch(() => {});
        }
        // Convert to WebP
        toWebp(destPath);
        return true;
      } else {
        console.log(`  ✗ ${article.imageName} — download failed`);
        return false;
      }
    });

    const succeeded = results.filter(Boolean).length;
    totalDownloaded += succeeded;
    totalFailed += (results.length - succeeded);
    console.log(`  → ${succeeded}/${articlesInGroup.length} downloaded`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Downloaded: ${totalDownloaded}`);
  console.log(`❌ Failed:     ${totalFailed}`);
  console.log(`📡 API calls:  ${apiCallCount}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(console.error);
