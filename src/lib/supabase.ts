import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.PUBLIC_SUPABASE_URL  as string;
const supabaseKey  = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string;

// Singleton — safe to import from any client-side script
export const supabase = createClient(supabaseUrl, supabaseKey);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface SavedArticle {
  id: string;
  user_id: string;
  article_slug: string;
  destination: string;
  title: string;
  hero_image: string | null;
  saved_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  countries: string[];
  activities: string[];
  updated_at: string;
}
