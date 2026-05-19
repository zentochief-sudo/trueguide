export type RelatedArticle = {
  title: string;
  description: string;
  slug: string;
  destination: string;
  heroImage?: string;
  category: string;
  readingTime: number;
  city: string;
  href: string;
};

type ArticleEntry = {
  id: string;
  data: {
    title: string;
    description: string;
    destination: string;
    heroImage?: string;
    category: string;
    readingTime: number;
    publishDate: Date;
    city?: string;
    tags?: string[];
  };
};

function destToPath(destination: string): string {
  if (destination === 'South Korea') return 'korea';
  if (destination === 'Costa Rica') return 'costa-rica';
  if (destination === 'Réunion') return 'reunion';
  return destination
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export function getRelatedArticles(
  all: ArticleEntry[],
  current: ArticleEntry,
  limit = 3
): RelatedArticle[] {
  const currentTags = new Set(current.data.tags ?? []);
  const destPath = destToPath(current.data.destination);

  return all
    .filter((a) => a.id !== current.id)
    .map((a) => ({
      article: a,
      score: (a.data.tags ?? []).filter((t) => currentTags.has(t)).length,
    }))
    .sort((a, b) =>
      b.score !== a.score
        ? b.score - a.score
        : b.article.data.publishDate.getTime() - a.article.data.publishDate.getTime()
    )
    .slice(0, limit)
    .map(({ article: a }) => ({
      title: a.data.title,
      description: a.data.description,
      slug: a.id,
      destination: a.data.destination,
      heroImage: a.data.heroImage,
      category: a.data.category,
      readingTime: a.data.readingTime,
      city: a.data.city ?? 'national',
      href: `/${destPath}/${a.id}`,
    }));
}
