import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type ScoopCategory = 'lease_move' | 'rfp' | 'expansion' | 'contraction' | 'personnel' | 'concession' | 'conversion' | 'general';

export type Scoop = {
  id: string;
  author_name: string;
  author_avatar: string;
  content: string;
  category: ScoopCategory;
  tags: string[];
  linked_tenant_id: string | null;
  linked_building_id: string | null;
  linked_tenant_name: string | null;
  linked_building_name: string | null;
  likes_count: number;
  comments_count: number;
  verified: boolean;
  created_at: string;
};

export type ScoopComment = {
  id: string;
  scoop_id: string;
  author_name: string;
  author_avatar: string;
  content: string;
  created_at: string;
};

const SESSION_ID = (() => {
  let id = localStorage.getItem('scoop-session-id');
  if (!id) {
    id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem('scoop-session-id', id);
  }
  return id;
})();

export function useScoops() {
  const [scoops, setScoops] = useState<Scoop[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const fetchScoops = useCallback(async () => {
    const { data, error } = await supabase
      .from('scoops')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching scoops:', error);
      toast.error('Failed to load scoops');
      return;
    }
    setScoops((data || []) as unknown as Scoop[]);
    setLoading(false);
  }, []);

  // Fetch user's likes
  const fetchLikes = useCallback(async () => {
    const { data } = await supabase
      .from('scoop_likes')
      .select('scoop_id')
      .eq('session_id', SESSION_ID);
    if (data) {
      setLikedIds(new Set(data.map((l: any) => l.scoop_id)));
    }
  }, []);

  useEffect(() => {
    fetchScoops();
    fetchLikes();

    // Realtime subscription
    const channel = supabase
      .channel('scoops-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scoops' }, () => {
        fetchScoops();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchScoops, fetchLikes]);

  const createScoop = async (scoop: {
    content: string;
    category: ScoopCategory;
    tags: string[];
    author_name: string;
    author_avatar: string;
    linked_tenant_id?: string;
    linked_building_id?: string;
    linked_tenant_name?: string;
    linked_building_name?: string;
  }) => {
    const { error } = await supabase.from('scoops').insert([scoop] as any);
    if (error) {
      toast.error('Failed to post scoop');
      return false;
    }
    await fetchScoops();
    // Auto-digest: feed scoop to AI brain
    const { digestEvent } = await import('@/lib/autoDigest');
    digestEvent('scoop_posted', {
      content: scoop.content,
      category: scoop.category,
      tags: scoop.tags,
      tenant: scoop.linked_tenant_name || '',
      building: scoop.linked_building_name || '',
    });
    return true;
  };

  const toggleLike = async (scoopId: string) => {
    const isLiked = likedIds.has(scoopId);
    if (isLiked) {
      await supabase.from('scoop_likes').delete().eq('scoop_id', scoopId).eq('session_id', SESSION_ID);
      setLikedIds(prev => { const n = new Set(prev); n.delete(scoopId); return n; });
    } else {
      await supabase.from('scoop_likes').insert([{ scoop_id: scoopId, session_id: SESSION_ID }] as any);
      setLikedIds(prev => new Set(prev).add(scoopId));
    }
    await fetchScoops();
  };

  const verifyScoop = async (scoopId: string, verifierName: string) => {
    const { error } = await supabase.from('scoop_verifications').insert([{
      scoop_id: scoopId,
      verifier_name: verifierName,
      session_id: SESSION_ID,
    }] as any);
    if (error) {
      if (error.code === '23505') {
        toast.info('You already verified this scoop');
      } else {
        toast.error('Failed to verify');
      }
      return;
    }
    toast.success('Scoop verified!');
    await fetchScoops();
  };

  return { scoops, loading, likedIds, createScoop, toggleLike, verifyScoop, SESSION_ID };
}

export function useScoopComments(scoopId: string | null) {
  const [comments, setComments] = useState<ScoopComment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!scoopId) return;
    setLoading(true);
    const { data } = await supabase
      .from('scoop_comments')
      .select('*')
      .eq('scoop_id', scoopId)
      .order('created_at', { ascending: true });
    setComments((data || []) as unknown as ScoopComment[]);
    setLoading(false);
  }, [scoopId]);

  useEffect(() => {
    fetchComments();

    if (!scoopId) return;
    const channel = supabase
      .channel(`comments-${scoopId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scoop_comments', filter: `scoop_id=eq.${scoopId}` }, () => {
        fetchComments();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [scoopId, fetchComments]);

  const addComment = async (content: string, authorName: string, authorAvatar: string) => {
    if (!scoopId) return false;
    const { error } = await supabase.from('scoop_comments').insert([{
      scoop_id: scoopId,
      author_name: authorName,
      author_avatar: authorAvatar,
      content,
    }] as any);
    if (error) {
      toast.error('Failed to add comment');
      return false;
    }
    return true;
  };

  return { comments, loading, addComment };
}
