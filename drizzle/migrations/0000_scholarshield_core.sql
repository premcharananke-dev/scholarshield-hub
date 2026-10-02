-- ===== Roles =====
CREATE TYPE public.app_role AS ENUM ('admin', 'student');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ===== Student profiles =====
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  student_id text,
  email text NOT NULL DEFAULT '',
  phone text,
  college text,
  department text,
  course text,
  course_stream text,
  study_level text,
  year_of_study integer CHECK (year_of_study IS NULL OR year_of_study BETWEEN 1 AND 6),
  gender text CHECK (gender IS NULL OR gender IN ('Female','Male','Other','Prefer not to say')),
  use_gender_for_matching boolean NOT NULL DEFAULT true,
  academic_percentage numeric CHECK (academic_percentage IS NULL OR academic_percentage BETWEEN 0 AND 100),
  family_income numeric CHECK (family_income IS NULL OR family_income >= 0),
  category text CHECK (category IS NULL OR category IN ('General','OBC','SC','ST')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== Scholarships (eligibility rules are structured columns on each scholarship) =====
CREATE TABLE public.scholarships (
  id text PRIMARY KEY,
  name text NOT NULL,
  provider text NOT NULL,
  provider_type text NOT NULL DEFAULT 'Government' CHECK (provider_type IN ('Government','Private')),
  description text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  eligible_gender text NOT NULL DEFAULT 'Any' CHECK (eligible_gender IN ('Any','Female')),
  study_levels text[] NOT NULL DEFAULT '{}',
  course_streams text[] NOT NULL DEFAULT '{}',
  eligible_years integer[] NOT NULL DEFAULT '{}',
  max_income numeric,
  min_percentage numeric,
  percentage_basis text,
  eligible_categories text[] NOT NULL DEFAULT '{}',
  amount text NOT NULL DEFAULT 'Unverified',
  benefits text,
  documents text[] NOT NULL DEFAULT '{}',
  other_conditions text[] NOT NULL DEFAULT '{}',
  opening_date date,
  closing_date date,
  academic_year text,
  application_url text,
  source_url text,
  unverified_fields text[] NOT NULL DEFAULT '{}',
  verification_note text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scholarships TO authenticated;
GRANT ALL ON public.scholarships TO service_role;
ALTER TABLE public.scholarships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read active scholarships" ON public.scholarships FOR SELECT TO authenticated USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert scholarships" ON public.scholarships FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update scholarships" ON public.scholarships FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete scholarships" ON public.scholarships FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER scholarships_touch BEFORE UPDATE ON public.scholarships FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== Applications =====
CREATE SEQUENCE public.application_seq START 4;
GRANT USAGE ON SEQUENCE public.application_seq TO authenticated, service_role;
CREATE TABLE public.applications (
  id text PRIMARY KEY DEFAULT ('SS-' || extract(year FROM now())::int || '-' || lpad(nextval('public.application_seq')::text, 3, '0')),
  user_id uuid,
  scholarship_id text REFERENCES public.scholarships(id) ON DELETE SET NULL,
  scholarship_name text NOT NULL,
  full_name text NOT NULL,
  student_id text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  college text NOT NULL,
  course text NOT NULL,
  course_stream text,
  study_level text,
  department text,
  year_of_study integer,
  academic_year text NOT NULL,
  academic_percentage numeric NOT NULL CHECK (academic_percentage BETWEEN 0 AND 100),
  attendance numeric NOT NULL CHECK (attendance BETWEEN 0 AND 100),
  family_income numeric NOT NULL CHECK (family_income >= 0),
  category text NOT NULL CHECK (category IN ('General','OBC','SC','ST')),
  gender text,
  status text NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','ELIGIBILITY VERIFIED','NOT ELIGIBLE','UNDER REVIEW','APPROVED','REJECTED','DISBURSEMENT PENDING','DISBURSED')),
  status_note text,
  eligible boolean NOT NULL DEFAULT false,
  rules jsonb NOT NULL DEFAULT '[]',
  fingerprint text NOT NULL,
  is_duplicate boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX applications_user_idx ON public.applications(user_id);
CREATE INDEX applications_fp_idx ON public.applications(fingerprint);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or admin" ON public.applications FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Students submit own" ON public.applications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND is_demo = false AND status IN ('ELIGIBILITY VERIFIED','NOT ELIGIBLE'));
CREATE POLICY "Admins update applications" ON public.applications FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete applications" ON public.applications FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.application_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id text NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.application_history TO authenticated;
GRANT ALL ON public.application_history TO service_role;
ALTER TABLE public.application_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "History read own or admin" ON public.application_history FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.user_id = auth.uid()));

-- Duplicate check sees all rows (security definer) without exposing them.
CREATE OR REPLACE FUNCTION public.applications_before_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.is_duplicate := EXISTS (SELECT 1 FROM public.applications WHERE fingerprint = NEW.fingerprint);
  RETURN NEW;
END $$;
CREATE TRIGGER applications_bi BEFORE INSERT ON public.applications FOR EACH ROW EXECUTE FUNCTION public.applications_before_insert();

CREATE OR REPLACE FUNCTION public.applications_after_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.application_history(application_id, status, note, created_at) VALUES (NEW.id, 'SUBMITTED', 'Application submitted', NEW.submitted_at);
  INSERT INTO public.application_history(application_id, status, note, created_at) VALUES (NEW.id, NEW.status,
    CASE WHEN NEW.eligible THEN 'Automatic eligibility check passed' ELSE 'Automatic eligibility check found unmet conditions' END, NEW.submitted_at);
  RETURN NEW;
END $$;
CREATE TRIGGER applications_ai AFTER INSERT ON public.applications FOR EACH ROW EXECUTE FUNCTION public.applications_after_insert();

-- ===== Disbursement records =====
CREATE TABLE public.disbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id text NOT NULL UNIQUE REFERENCES public.applications(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED')),
  payment_reference text,
  payment_date date,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.disbursements TO authenticated;
GRANT ALL ON public.disbursements TO service_role;
ALTER TABLE public.disbursements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Disbursement read own or admin" ON public.disbursements FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.user_id = auth.uid()));
CREATE POLICY "Admins create disbursement" ON public.disbursements FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND status = 'PENDING');
CREATE POLICY "Admins update disbursement" ON public.disbursements FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER disbursements_touch BEFORE UPDATE ON public.disbursements FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Status guard: enforces the approval -> disbursement order.
CREATE OR REPLACE FUNCTION public.applications_before_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'DISBURSEMENT PENDING' AND OLD.status <> 'APPROVED' THEN
      RAISE EXCEPTION 'Disbursement can only start after approval';
    END IF;
    IF NEW.status = 'DISBURSED' AND NOT EXISTS (SELECT 1 FROM public.disbursements d WHERE d.application_id = NEW.id AND d.status = 'COMPLETED') THEN
      RAISE EXCEPTION 'A completed payment record is required before marking as disbursed';
    END IF;
    IF OLD.status IN ('DISBURSEMENT PENDING','DISBURSED') AND NEW.status NOT IN ('DISBURSEMENT PENDING','DISBURSED') THEN
      RAISE EXCEPTION 'Status cannot change once disbursement has started';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER applications_bu BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.applications_before_update();

CREATE OR REPLACE FUNCTION public.applications_after_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.application_history(application_id, status, note) VALUES (NEW.id, NEW.status, COALESCE(NULLIF(NEW.status_note,''), 'Status changed to ' || NEW.status));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER applications_au AFTER UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.applications_after_update();

CREATE OR REPLACE FUNCTION public.disbursements_sync() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.applications SET status = 'DISBURSEMENT PENDING', status_note = 'Disbursement record created for ₹' || NEW.amount WHERE id = NEW.application_id;
  ELSIF NEW.status = 'COMPLETED' AND OLD.status <> 'COMPLETED' THEN
    IF COALESCE(NEW.payment_reference,'') = '' OR NEW.payment_date IS NULL THEN
      RAISE EXCEPTION 'Payment reference and date are required';
    END IF;
    UPDATE public.applications SET status = 'DISBURSED', status_note = 'Payment recorded (ref ' || NEW.payment_reference || ')' WHERE id = NEW.application_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER disbursements_ai AFTER INSERT OR UPDATE ON public.disbursements FOR EACH ROW EXECUTE FUNCTION public.disbursements_sync();

-- ===== Application documents (checklist) =====
CREATE TABLE public.application_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id text NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  document_name text NOT NULL,
  provided boolean NOT NULL DEFAULT false,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.application_documents TO authenticated;
GRANT ALL ON public.application_documents TO service_role;
ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Docs read own or admin" ON public.application_documents FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.user_id = auth.uid()));
CREATE POLICY "Docs insert own" ON public.application_documents FOR INSERT TO authenticated WITH CHECK (
  verified = false AND EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.user_id = auth.uid()));
CREATE POLICY "Docs admin verify" ON public.application_documents FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ===== Saved scholarships =====
CREATE TABLE public.saved_scholarships (
  user_id uuid NOT NULL,
  scholarship_id text NOT NULL REFERENCES public.scholarships(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scholarship_id)
);
GRANT SELECT, INSERT, DELETE ON public.saved_scholarships TO authenticated;
GRANT ALL ON public.saved_scholarships TO service_role;
ALTER TABLE public.saved_scholarships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Saved own read" ON public.saved_scholarships FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Saved own insert" ON public.saved_scholarships FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Saved own delete" ON public.saved_scholarships FOR DELETE TO authenticated USING (user_id = auth.uid());