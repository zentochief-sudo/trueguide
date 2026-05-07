import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const japanArticles  = await getCollection('japan');
  const koreaArticles  = await getCollection('korea');
  const usaArticles    = await getCollection('usa');
  const mexicoArticles = await getCollection('mexico');
  const canadaArticles = await getCollection('canada');

  const articles = [
    ...japanArticles,
    ...koreaArticles,
    ...usaArticles,
    ...mexicoArticles,
    ...canadaArticles,
  ].map((a) => ({
    title: a.data.title,
    slug: a.id,
    destination: a.data.destination,
    category: a.data.category,
    description: a.data.description,
    city: a.data.city ?? 'national',
  }));

  return new Response(JSON.stringify(articles), {
    headers: { 'Content-Type': 'application/json' },
  });
};
