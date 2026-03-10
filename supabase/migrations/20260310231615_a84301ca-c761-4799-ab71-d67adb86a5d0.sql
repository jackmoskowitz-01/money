
-- Scoop categories enum
CREATE TYPE public.scoop_category AS ENUM (
  'lease_move', 'rfp', 'expansion', 'contraction', 'personnel', 'concession', 'conversion', 'general'
);

-- Scoops table
CREATE TABLE public.scoops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_name TEXT NOT NULL DEFAULT 'Anonymous',
  author_avatar TEXT NOT NULL DEFAULT 'AN',
  content TEXT NOT NULL,
  category scoop_category NOT NULL DEFAULT 'general',
  tags TEXT[] NOT NULL DEFAULT '{}',
  linked_tenant_id TEXT,
  linked_building_id TEXT,
  linked_tenant_name TEXT,
  linked_building_name TEXT,
  likes_count INT NOT NULL DEFAULT 0,
  comments_count INT NOT NULL DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scoop comments table
CREATE TABLE public.scoop_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scoop_id UUID NOT NULL REFERENCES public.scoops(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT 'Anonymous',
  author_avatar TEXT NOT NULL DEFAULT 'AN',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scoop likes tracking (prevent double-likes per session)
CREATE TABLE public.scoop_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scoop_id UUID NOT NULL REFERENCES public.scoops(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(scoop_id, session_id)
);

-- Scoop verifications
CREATE TABLE public.scoop_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scoop_id UUID NOT NULL REFERENCES public.scoops(id) ON DELETE CASCADE,
  verifier_name TEXT NOT NULL,
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(scoop_id, session_id)
);

-- Enable RLS
ALTER TABLE public.scoops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoop_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoop_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoop_verifications ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (no auth required for this collaborative board)
CREATE POLICY "Anyone can read scoops" ON public.scoops FOR SELECT USING (true);
CREATE POLICY "Anyone can insert scoops" ON public.scoops FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update scoops" ON public.scoops FOR UPDATE USING (true);

CREATE POLICY "Anyone can read comments" ON public.scoop_comments FOR SELECT USING (true);
CREATE POLICY "Anyone can insert comments" ON public.scoop_comments FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read likes" ON public.scoop_likes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert likes" ON public.scoop_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete likes" ON public.scoop_likes FOR DELETE USING (true);

CREATE POLICY "Anyone can read verifications" ON public.scoop_verifications FOR SELECT USING (true);
CREATE POLICY "Anyone can insert verifications" ON public.scoop_verifications FOR INSERT WITH CHECK (true);

-- Function to increment/decrement counts
CREATE OR REPLACE FUNCTION public.update_scoop_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_TABLE_NAME = 'scoop_comments' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.scoops SET comments_count = comments_count + 1 WHERE id = NEW.scoop_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.scoops SET comments_count = comments_count - 1 WHERE id = OLD.scoop_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'scoop_likes' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.scoops SET likes_count = likes_count + 1 WHERE id = NEW.scoop_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.scoops SET likes_count = likes_count - 1 WHERE id = OLD.scoop_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'scoop_verifications' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.scoops SET verified = true WHERE id = NEW.scoop_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER on_comment_change
  AFTER INSERT OR DELETE ON public.scoop_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_scoop_counts();

CREATE TRIGGER on_like_change
  AFTER INSERT OR DELETE ON public.scoop_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_scoop_counts();

CREATE TRIGGER on_verification_change
  AFTER INSERT ON public.scoop_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_scoop_counts();

-- Enable realtime for scoops
ALTER PUBLICATION supabase_realtime ADD TABLE public.scoops;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scoop_comments;
