
-- ROLES SYSTEM
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Auto-grant admin to the two allowed verified emails
CREATE OR REPLACE FUNCTION public.grant_dealroom_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(NEW.email) IN ('prosperirhebhude65@gmail.com','prosperozoya50@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_dealroom_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_dealroom_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_dealroom_admin();

DROP TRIGGER IF EXISTS on_auth_user_confirmed_grant_dealroom_admin ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_grant_dealroom_admin
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_dealroom_admin();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- DOCUMENTS
CREATE TABLE public.deal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'Pitch Deck',
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_documents TO authenticated;
GRANT ALL ON public.deal_documents TO service_role;
ALTER TABLE public.deal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage documents" ON public.deal_documents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_deal_documents_updated_at
  BEFORE UPDATE ON public.deal_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public metadata-only listing (no file_path exposure)
CREATE OR REPLACE FUNCTION public.get_public_deal_documents()
RETURNS TABLE (id uuid, title text, description text, category text, file_name text, file_size bigint, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, title, description, category, file_name, file_size, created_at
  FROM public.deal_documents ORDER BY created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_deal_documents() TO anon, authenticated;

-- ACCESS REQUESTS
CREATE TABLE public.deal_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.deal_documents(id) ON DELETE CASCADE,
  buyer_name text NOT NULL,
  buyer_email text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending',
  download_token text,
  token_expires_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_access_requests TO authenticated;
GRANT INSERT ON public.deal_access_requests TO anon;
GRANT ALL ON public.deal_access_requests TO service_role;
ALTER TABLE public.deal_access_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (buyers, not logged in) can submit a request
CREATE POLICY "Anyone can request access" ON public.deal_access_requests
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins view requests" ON public.deal_access_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update requests" ON public.deal_access_requests
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete requests" ON public.deal_access_requests
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_deal_access_requests_updated_at
  BEFORE UPDATE ON public.deal_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- VISITOR LOGS
CREATE TABLE public.deal_visitor_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  buyer_email text,
  document_id uuid REFERENCES public.deal_documents(id) ON DELETE SET NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.deal_visitor_logs TO anon, authenticated;
GRANT SELECT ON public.deal_visitor_logs TO authenticated;
GRANT ALL ON public.deal_visitor_logs TO service_role;
ALTER TABLE public.deal_visitor_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log a visit" ON public.deal_visitor_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins view logs" ON public.deal_visitor_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- STORAGE POLICIES (private bucket deal-room-docs)
CREATE POLICY "Admins upload deal docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'deal-room-docs' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read deal docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'deal-room-docs' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete deal docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'deal-room-docs' AND public.has_role(auth.uid(), 'admin'));
