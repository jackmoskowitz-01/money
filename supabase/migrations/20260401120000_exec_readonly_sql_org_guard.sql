-- Require AI-generated SELECTs to reference organization_id and the caller's org UUID
-- when expected_org_id is provided (DealFlow Copilot path).

DROP FUNCTION IF EXISTS public.exec_readonly_sql(text);

CREATE OR REPLACE FUNCTION public.exec_readonly_sql(query_text text, expected_org_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  normalized text;
BEGIN
  normalized := lower(trim(query_text));

  IF NOT (normalized LIKE 'select%' OR normalized LIKE 'with%') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  IF normalized ~ '(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|execute|do\s)' THEN
    RAISE EXCEPTION 'Mutation queries are not allowed';
  END IF;

  IF expected_org_id IS NOT NULL THEN
    IF strpos(normalized, 'organization_id') = 0 THEN
      RAISE EXCEPTION 'Query must reference organization_id';
    END IF;
    IF strpos(normalized, lower(expected_org_id::text)) = 0 THEN
      RAISE EXCEPTION 'Query must filter by the current organization';
    END IF;
  END IF;

  EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', query_text) INTO result;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_readonly_sql(text, uuid) TO service_role;
