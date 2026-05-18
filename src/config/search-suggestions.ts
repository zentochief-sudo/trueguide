/**
 * Search Overlay — Featured Carousels Config
 *
 * Add or edit carousels here to control what appears in the search overlay
 * before the user starts typing. Set `enabled: false` to hide a carousel
 * without deleting it.
 *
 * - `query`   : used to auto-select matching articles from search.json
 *               AND as the ?q= param for the "Everything from" link.
 * - `pinnedSlugs` (optional): if provided, show these specific article slugs
 *               instead of auto-selecting by query (still uses query for the link).
 */
export interface FeaturedCarousel {
  id: string
  title: string
  enabled: boolean
  query: string
  pinnedSlugs?: string[]
}

export const featuredCarousels: FeaturedCarousel[] = [
  {
    id: 'fifa-world-cup-2026',
    title: 'FIFA World Cup 2026',
    enabled: true,
    query: 'FIFA World Cup',
  },
]
