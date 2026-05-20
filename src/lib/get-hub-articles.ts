/**
 * getHubArticles — returns merged + sorted articles for a destination hub.
 *
 * Combines the destination's own collection with any cross-destination
 * guides that include it in their `destinations` array.
 *
 * Each returned entry has an optional `guideHref` field set for guide
 * articles so ArticleCard can use the correct `/guides/[slug]` URL.
 */
import { getCollection } from 'astro:content';

export type HubArticle = {
  id: string;
  data: {
    title: string;
    description: string;
    destination: string;
    category: string;
    heroImage?: string;
    readingTime: number;
    publishDate: Date;
    city?: string;
    tags?: string[];
    etsy_template?: string;
    tocStyle?: string;
    destinations?: string[];
  };
  guideHref?: string; // set for cross-destination guides
};

export async function getHubArticles(collectionName: string, destSlug: string): Promise<HubArticle[]> {
  // Own collection
  const own = await getCollection(collectionName as any);

  // Cross-destination guides that include this destination
  let guides: HubArticle[] = [];
  try {
    const allGuides = await getCollection('guides' as any);
    guides = (allGuides as any[])
      .filter((g: any) => (g.data.destinations ?? []).includes(destSlug))
      .map((g: any) => ({ ...g, guideHref: `/guides/${g.id}` }));
  } catch {
    // guides collection may not exist yet — fail silently
  }

  const merged = [...(own as any[]), ...guides] as HubArticle[];
  return merged.sort((a, b) => b.data.publishDate.getTime() - a.data.publishDate.getTime());
}
