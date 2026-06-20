
-- 1. profile status
DO $$ BEGIN
  CREATE TYPE public.profile_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status public.profile_status NOT NULL DEFAULT 'pending';

-- Backfill: existing users approved; admin emails always approved
UPDATE public.profiles SET status = 'approved'
  WHERE status = 'pending';

-- 2. super admin helper
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id AND email = 'turikumanaisaie@gmail.com'
  )
$$;

-- 3. profiles policies for super admin
DROP POLICY IF EXISTS "Super admin manages profiles" ON public.profiles;
CREATE POLICY "Super admin manages profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 4. update handle_new_user: pending by default, admins auto-approved
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  admin_emails TEXT[] := ARRAY['turikumanaisaie@gmail.com','tieflab@gmail.com'];
  v_status public.profile_status;
BEGIN
  v_status := CASE WHEN NEW.email = ANY(admin_emails) THEN 'approved'::public.profile_status
                   ELSE 'pending'::public.profile_status END;

  INSERT INTO public.profiles (id, email, display_name, status)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)), v_status);

  IF NEW.email = ANY(admin_emails) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.income_settings (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;

  INSERT INTO public.categories (user_id, name, percentage, color, icon, sort_order) VALUES
    (NEW.id, 'Rent & Utilities', 35, '#7c3aed', 'home', 1),
    (NEW.id, 'Food & Groceries', 30, '#a855f7', 'utensils', 2),
    (NEW.id, 'Transport', 15, '#c084fc', 'car', 3),
    (NEW.id, 'Savings/Emergency', 10, '#22c55e', 'piggy-bank', 4),
    (NEW.id, 'Personal/Misc', 10, '#f59e0b', 'sparkles', 5);

  INSERT INTO public.sources (user_id, name) VALUES
    (NEW.id, 'Mobile Money'),
    (NEW.id, 'Equity Bank'),
    (NEW.id, 'I&M Bank'),
    (NEW.id, 'Cash');

  RETURN NEW;
END; $$;

-- Trigger (in case it's missing)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. expected_income table
CREATE TABLE IF NOT EXISTS public.expected_income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_id uuid REFERENCES public.sources(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  note text,
  is_recurring boolean NOT NULL DEFAULT false,
  frequency text,
  expected_date date NOT NULL DEFAULT CURRENT_DATE,
  received boolean NOT NULL DEFAULT false,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expected_income TO authenticated;
GRANT ALL ON public.expected_income TO service_role;

ALTER TABLE public.expected_income ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Expected: own all" ON public.expected_income;
CREATE POLICY "Expected: own all" ON public.expected_income
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS expected_income_updated_at ON public.expected_income;
CREATE TRIGGER expected_income_updated_at BEFORE UPDATE ON public.expected_income
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
