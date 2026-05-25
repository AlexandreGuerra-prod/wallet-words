-- Lock down materialize_due_recurrences
REVOKE EXECUTE ON FUNCTION public.materialize_due_recurrences(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.materialize_due_recurrences(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  inserted integer := 0;
  next_date date;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR r IN
    SELECT * FROM public.recurrences
    WHERE user_id = _user_id AND active = true AND next_run_at <= CURRENT_DATE
  LOOP
    WHILE r.next_run_at <= CURRENT_DATE LOOP
      INSERT INTO public.transactions
        (user_id, type, amount, description, category_id, account_id, occurred_at, source, recurrence_id)
      VALUES
        (r.user_id, r.type, r.amount, r.description, r.category_id, r.account_id, r.next_run_at, 'recurrence', r.id);
      inserted := inserted + 1;

      next_date := CASE r.frequency
        WHEN 'weekly'  THEN r.next_run_at + INTERVAL '7 days'
        WHEN 'monthly' THEN (r.next_run_at + INTERVAL '1 month')::date
        WHEN 'yearly'  THEN (r.next_run_at + INTERVAL '1 year')::date
      END;
      r.next_run_at := next_date;
    END LOOP;
    UPDATE public.recurrences SET next_run_at = r.next_run_at WHERE id = r.id;
  END LOOP;
  RETURN inserted;
END; $$;

GRANT EXECUTE ON FUNCTION public.materialize_due_recurrences(uuid) TO authenticated;