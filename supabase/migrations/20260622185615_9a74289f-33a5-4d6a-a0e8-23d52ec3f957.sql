
CREATE OR REPLACE FUNCTION public.tg_prevent_protected_delete()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.is_protected THEN
    RAISE EXCEPTION 'Cannot delete a protected category';
  END IF;
  RETURN OLD;
END; $$;
