/**
 * faq.ts — Extract FAQ pairs from markdown body for FAQPage schema.
 *
 * Strategy: each H2 heading becomes a Question; the first paragraph
 * of that section (stripped of markdown) becomes the Answer.
 *
 * Used by ArticleLayout for Seasonal articles to generate FAQPage JSON-LD.
 */

export interface FAQPair {
  q: string;
  a: string;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // links → text
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')       // images → remove
    .replace(/\*\*([^*]+)\*\*/g, '$1')           // bold
    .replace(/\*([^*]+)\*/g, '$1')               // italic
    .replace(/`([^`]+)`/g, '$1')                 // inline code
    .replace(/^#{1,6}\s+/gm, '')                 // headings
    .replace(/^[-*+]\s+/gm, '')                  // list items
    .replace(/^\d+\.\s+/gm, '')                  // numbered list
    .replace(/^>\s+/gm, '')                       // blockquotes
    .replace(/\n{2,}/g, ' ')                      // multiple newlines → space
    .replace(/\n/g, ' ')
    .trim();
}

export function extractFAQs(body: string, limit = 6): FAQPair[] {
  if (!body) return [];

  const faqs: FAQPair[] = [];
  // Match H2 headings (## Heading)
  const h2Regex = /^## (.+)$/gm;
  const matches: { heading: string; index: number }[] = [];
  let m: RegExpExecArray | null;

  while ((m = h2Regex.exec(body)) !== null) {
    matches.push({ heading: m[1], index: m.index + m[0].length });
  }

  for (let i = 0; i < matches.length && faqs.length < limit; i++) {
    const { heading, index } = matches[i];
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : body.length;
    const sectionBody = body.slice(index, nextIndex).trim();

    // First paragraph = text up to first blank line (skip sub-headings)
    const paragraphs = sectionBody.split(/\n\n+/);
    let answer = '';
    for (const para of paragraphs) {
      const stripped = stripMarkdown(para);
      if (stripped.length > 40 && !para.startsWith('#') && !para.startsWith('---')) {
        answer = stripped.slice(0, 600);
        break;
      }
    }

    if (!answer) continue;

    const question = stripMarkdown(heading);
    if (question.length < 5) continue;

    // Convert heading to natural question if it isn't one already
    const naturalQ = question.endsWith('?')
      ? question
      : toQuestion(question);

    faqs.push({ q: naturalQ, a: answer });
  }

  return faqs;
}

/** Turn a heading like "Weather in January" → "What is the weather like in January?" */
function toQuestion(heading: string): string {
  const h = heading.trim();
  // Headings that start with "Why", "How", "When", "What", "Is", "Are", "Can" → add ?
  if (/^(why|how|when|what|where|who|is|are|can|do|does|will|should)/i.test(h)) {
    return h + '?';
  }
  // "Weather in January" → "What is the weather like in January?"
  if (/^weather/i.test(h)) return `What is the ${h.toLowerCase()}?`;
  // "Best Time to Visit" → keep + ?
  if (/^best time/i.test(h)) return h + '?';
  // "Things to Do" → "What are the best things to do..."
  if (/^things to do/i.test(h)) return `What are the best ${h.toLowerCase()}?`;
  // "Getting Around" → "How do you get around..."
  if (/^getting around/i.test(h)) return `How do you get around — ${h}?`;
  // Default: wrap in "What about [heading]?"
  return `${h}?`;
}

export function buildFAQSchema(faqs: FAQPair[]) {
  if (!faqs.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: a,
      },
    })),
  };
}
