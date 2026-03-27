-- ============================================================
-- Dealflow RAG: Embeddings Table + Search Function
-- Adapted for DealFlow multi-tenancy (organization_id)
-- ============================================================

-- Enable pgvector extension
create extension if not exists vector;

-- ============================================================
-- EMBEDDINGS TABLE
-- ============================================================
create table if not exists embeddings (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_type     text not null check (
                    source_type in ('deal', 'contact', 'activity', 'scoop', 'document')
                  ),
  source_id       text not null,
  content         text not null,
  embedding       vector(1536),
  metadata        jsonb default '{}',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Unique constraint for upserts
create unique index if not exists embeddings_org_source_idx
  on embeddings (organization_id, source_type, source_id);

-- Index for fast cosine similarity search
create index if not exists embeddings_embedding_idx
  on embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Index for org-scoped queries
create index if not exists embeddings_org_id_idx
  on embeddings (organization_id);

-- Auto-update updated_at
create or replace function update_embeddings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists embeddings_updated_at on embeddings;
create trigger embeddings_updated_at
  before update on embeddings
  for each row execute function update_embeddings_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table embeddings enable row level security;

create policy "Org-scoped read embeddings" on embeddings for select
  using (organization_id = public.get_user_org_id() or public.is_super_admin());

create policy "Org-scoped insert embeddings" on embeddings for insert
  with check (organization_id = public.get_user_org_id() or public.is_super_admin());

create policy "Org-scoped update embeddings" on embeddings for update
  using (organization_id = public.get_user_org_id() or public.is_super_admin());

create policy "Org-scoped delete embeddings" on embeddings for delete
  using (organization_id = public.get_user_org_id() or public.is_super_admin());

-- ============================================================
-- SIMILARITY SEARCH FUNCTION
-- ============================================================
create or replace function match_embeddings(
  query_embedding   vector(1536),
  match_org_id      uuid,
  match_count       int     default 5,
  match_threshold   float   default 0.45,
  filter_type       text    default null
)
returns table (
  id              uuid,
  source_type     text,
  source_id       text,
  content         text,
  metadata        jsonb,
  similarity      float
)
language sql stable
as $$
  select
    id,
    source_type,
    source_id,
    content,
    metadata,
    1 - (embedding <=> query_embedding) as similarity
  from embeddings
  where
    organization_id = match_org_id
    and 1 - (embedding <=> query_embedding) > match_threshold
    and (filter_type is null or source_type = filter_type)
  order by embedding <=> query_embedding
  limit match_count;
$$;
