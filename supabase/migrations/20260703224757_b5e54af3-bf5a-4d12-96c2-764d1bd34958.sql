CREATE TABLE public.poi_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key text NOT NULL UNIQUE,
  query text NOT NULL,
  payload jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours')
);

GRANT ALL ON public.poi_cache TO service_role;

ALTER TABLE public.poi_cache ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_poi_cache_key ON public.poi_cache (cache_key);