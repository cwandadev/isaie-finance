
-- Strict per-user isolation: remove admin override on user-data tables
DROP POLICY IF EXISTS "Categories: own all" ON public.categories;
CREATE POLICY "Categories: own all" ON public.categories FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Sources: own all" ON public.sources;
CREATE POLICY "Sources: own all" ON public.sources FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Income: own all" ON public.income_settings;
CREATE POLICY "Income: own all" ON public.income_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Tx: own all" ON public.transactions;
CREATE POLICY "Tx: own all" ON public.transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Expected: own all" ON public.expected_income;
CREATE POLICY "Expected: own all" ON public.expected_income FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Profiles: own profile OR super-admin can read all (for user-mgmt only)
DROP POLICY IF EXISTS "Profiles: own or admin select" ON public.profiles;
CREATE POLICY "Profiles: own or super-admin select" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_super_admin(auth.uid()));

-- Profile new fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Expected income destination category
ALTER TABLE public.expected_income
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- Protected categories (cannot delete)
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_protected BOOLEAN NOT NULL DEFAULT false;

-- Mark existing Savings categories as protected
UPDATE public.categories SET is_protected = true WHERE name ILIKE '%saving%';

-- Trigger to block deleting protected categories
CREATE OR REPLACE FUNCTION public.tg_prevent_protected_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_protected THEN
    RAISE EXCEPTION 'Cannot delete a protected category';
  END IF;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_categories_protect ON public.categories;
CREATE TRIGGER trg_categories_protect BEFORE DELETE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_prevent_protected_delete();

-- Update seed to mark Savings protected for new users
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

  INSERT INTO public.income_settings (user_id, salary_day) VALUES (NEW.id, 29) ON CONFLICT DO NOTHING;

  INSERT INTO public.categories (user_id, name, percentage, color, icon, sort_order, is_protected) VALUES
    (NEW.id, 'Rent & Utilities', 35, '#7c3aed', 'home', 1, false),
    (NEW.id, 'Food & Groceries', 30, '#a855f7', 'utensils', 2, false),
    (NEW.id, 'Transport', 15, '#c084fc', 'car', 3, false),
    (NEW.id, 'Savings/Emergency', 10, '#22c55e', 'piggy-bank', 4, true),
    (NEW.id, 'Personal/Misc', 10, '#f59e0b', 'sparkles', 5, false);

  INSERT INTO public.sources (user_id, name) VALUES
    (NEW.id, 'Mobile Money'),
    (NEW.id, 'Equity Bank'),
    (NEW.id, 'I&M Bank'),
    (NEW.id, 'Cash');

  RETURN NEW;
END; $$;
