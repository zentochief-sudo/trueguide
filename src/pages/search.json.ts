import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const japanArticles  = await getCollection('japan');

  // Optional collections — wrapped in try/catch in case a collection doesn't exist yet
  let koreaArticles      = [] as typeof japanArticles;
  let usaArticles        = [] as typeof japanArticles;
  let mexicoArticles     = [] as typeof japanArticles;
  let canadaArticles     = [] as typeof japanArticles;
  let spainArticles      = [] as typeof japanArticles;
  let italyArticles      = [] as typeof japanArticles;
  let franceArticles     = [] as typeof japanArticles;
  let portugalArticles   = [] as typeof japanArticles;
  let irelandArticles    = [] as typeof japanArticles;
  let indiaArticles      = [] as typeof japanArticles;
  let thailandArticles   = [] as typeof japanArticles;
  let malaysiaArticles   = [] as typeof japanArticles;
  let peruArticles       = [] as typeof japanArticles;
  let costaRicaArticles  = [] as typeof japanArticles;
  let tanzaniaArticles   = [] as typeof japanArticles;
  let egyptArticles      = [] as typeof japanArticles;
  let pakistanArticles   = [] as typeof japanArticles;
  let kazakhstanArticles = [] as typeof japanArticles;
  let greenlandArticles  = [] as typeof japanArticles;
  let reunionArticles    = [] as typeof japanArticles;

  try { koreaArticles      = await getCollection('korea');      } catch {}
  try { usaArticles        = await getCollection('usa');        } catch {}
  try { mexicoArticles     = await getCollection('mexico');     } catch {}
  try { canadaArticles     = await getCollection('canada');     } catch {}
  try { spainArticles      = await getCollection('spain');      } catch {}
  try { italyArticles      = await getCollection('italy');      } catch {}
  try { franceArticles     = await getCollection('france');     } catch {}
  try { portugalArticles   = await getCollection('portugal');   } catch {}
  try { irelandArticles    = await getCollection('ireland');    } catch {}
  try { indiaArticles      = await getCollection('india');      } catch {}
  try { thailandArticles   = await getCollection('thailand');   } catch {}
  try { malaysiaArticles   = await getCollection('malaysia');   } catch {}
  try { peruArticles       = await getCollection('peru');       } catch {}
  try { costaRicaArticles  = await getCollection('costa_rica'); } catch {}
  try { tanzaniaArticles   = await getCollection('tanzania');   } catch {}
  try { egyptArticles      = await getCollection('egypt');      } catch {}
  try { pakistanArticles   = await getCollection('pakistan');   } catch {}
  try { kazakhstanArticles = await getCollection('kazakhstan'); } catch {}
  try { greenlandArticles  = await getCollection('greenland');  } catch {}
  try { reunionArticles    = await getCollection('reunion');    } catch {}

  const articles = [
    ...japanArticles,  ...koreaArticles,  ...usaArticles,    ...mexicoArticles,
    ...canadaArticles, ...spainArticles,  ...italyArticles,  ...franceArticles,
    ...portugalArticles, ...irelandArticles, ...indiaArticles, ...thailandArticles,
    ...malaysiaArticles, ...peruArticles, ...costaRicaArticles, ...tanzaniaArticles,
    ...egyptArticles,  ...pakistanArticles, ...kazakhstanArticles,
    ...greenlandArticles, ...reunionArticles,
  ].map((a) => {
    const dp = a.data.destination
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    return {
      title:       a.data.title,
      slug:        a.id,
      destination: a.data.destination,
      destPath:    dp,
      category:    a.data.category,
      description: a.data.description,
      heroImage:   a.data.heroImage ?? null,
      city:        a.data.city ?? 'national',
      publishDate: a.data.publishDate.toISOString(),
    };
  });

  return new Response(JSON.stringify(articles), {
    headers: { 'Content-Type': 'application/json' },
  });
};
