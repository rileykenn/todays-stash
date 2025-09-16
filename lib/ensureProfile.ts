// lib/ensureProfile.ts
import { sb } from '@/lib/supabaseBrowser';

export async function ensureProfile() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;

  // try to read profile
  const { data: prof, error } = await sb
    .from('profiles')
    .select('id')
    .eq('id', session.user.id)
    .single();

  if (!prof) {
    // insert own-row (RLS policy allows insert when id == auth.uid())
    await sb.from('profiles').insert({
      id: session.user.id,
      email: session.user.email ?? null,
    });
  }
}
