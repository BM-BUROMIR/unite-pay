import { getSupabase } from '../db.js';

export interface Project {
  id: string;
  slug: string;
  name: string;
  webhook_url: string;
  webhook_secret: string;
  api_key: string;
  notify_before_days: number;
  active: boolean;
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const { data } = await getSupabase()
    .from('pay_projects')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single();

  return data as Project | null;
}

export async function getAllActiveProjects(): Promise<Project[]> {
  const { data } = await getSupabase().from('pay_projects').select('*').eq('active', true);

  return (data || []) as Project[];
}
