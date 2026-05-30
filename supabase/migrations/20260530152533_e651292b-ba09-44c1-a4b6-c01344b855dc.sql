
-- enums
CREATE TYPE public.invoice_status AS ENUM ('open', 'closed', 'paid');

-- budgets
CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_id uuid NOT NULL,
  month date NOT NULL, -- always day=1
  amount numeric NOT NULL CHECK (amount >= 0),
  alert_80_sent_at timestamptz,
  alert_100_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
GRANT ALL ON public.budgets TO service_role;

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own budgets" ON public.budgets FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER budgets_touch BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- credit card invoices
CREATE TABLE public.credit_card_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL,
  reference_month date NOT NULL, -- day=1
  closing_date date NOT NULL,
  due_date date NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'open',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, reference_month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_card_invoices TO authenticated;
GRANT ALL ON public.credit_card_invoices TO service_role;

ALTER TABLE public.credit_card_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own invoices" ON public.credit_card_invoices FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER invoices_touch BEFORE UPDATE ON public.credit_card_invoices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- link transactions to invoices
ALTER TABLE public.transactions ADD COLUMN invoice_id uuid;
CREATE INDEX idx_transactions_invoice ON public.transactions(invoice_id);

-- trigger: assign credit-card transactions to invoices
CREATE OR REPLACE FUNCTION public.assign_transaction_to_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acc record;
  ref_month date;
  closing date;
  due date;
  inv_id uuid;
BEGIN
  IF NEW.account_id IS NULL THEN
    NEW.invoice_id := NULL;
    RETURN NEW;
  END IF;

  SELECT * INTO acc FROM public.accounts WHERE id = NEW.account_id;
  IF NOT FOUND OR acc.type <> 'credit_card' THEN
    NEW.invoice_id := NULL;
    RETURN NEW;
  END IF;

  -- determine closing date for this transaction
  IF acc.closing_day IS NULL THEN
    ref_month := date_trunc('month', NEW.occurred_at)::date;
    closing := (ref_month + INTERVAL '1 month - 1 day')::date;
  ELSE
    closing := make_date(EXTRACT(year FROM NEW.occurred_at)::int,
                         EXTRACT(month FROM NEW.occurred_at)::int,
                         LEAST(acc.closing_day, EXTRACT(day FROM (date_trunc('month', NEW.occurred_at) + INTERVAL '1 month - 1 day'))::int));
    IF NEW.occurred_at > closing THEN
      closing := (closing + INTERVAL '1 month')::date;
    END IF;
    ref_month := date_trunc('month', closing)::date;
  END IF;

  IF acc.due_day IS NULL THEN
    due := (closing + INTERVAL '10 days')::date;
  ELSE
    due := make_date(EXTRACT(year FROM closing + INTERVAL '1 month')::int,
                     EXTRACT(month FROM closing + INTERVAL '1 month')::int,
                     LEAST(acc.due_day, 28));
  END IF;

  INSERT INTO public.credit_card_invoices (user_id, account_id, reference_month, closing_date, due_date)
  VALUES (NEW.user_id, NEW.account_id, ref_month, closing, due)
  ON CONFLICT (account_id, reference_month) DO UPDATE
    SET closing_date = EXCLUDED.closing_date, due_date = EXCLUDED.due_date
  RETURNING id INTO inv_id;

  NEW.invoice_id := inv_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_invoice
  BEFORE INSERT OR UPDATE OF account_id, occurred_at ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.assign_transaction_to_invoice();

-- function: recompute invoice totals
CREATE OR REPLACE FUNCTION public.recompute_invoice_total(_invoice_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.credit_card_invoices i
  SET total_amount = COALESCE((SELECT SUM(amount) FROM public.transactions WHERE invoice_id = _invoice_id AND type = 'expense'), 0)
  WHERE i.id = _invoice_id;
$$;

CREATE OR REPLACE FUNCTION public.trg_recompute_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.invoice_id IS NOT NULL THEN PERFORM public.recompute_invoice_total(OLD.invoice_id); END IF;
    RETURN OLD;
  END IF;
  IF NEW.invoice_id IS NOT NULL THEN PERFORM public.recompute_invoice_total(NEW.invoice_id); END IF;
  IF TG_OP = 'UPDATE' AND OLD.invoice_id IS DISTINCT FROM NEW.invoice_id AND OLD.invoice_id IS NOT NULL THEN
    PERFORM public.recompute_invoice_total(OLD.invoice_id);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_tx_recompute_invoice
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_invoice();

-- forecast function
CREATE OR REPLACE FUNCTION public.forecast_cashflow(_user_id uuid, _days int)
RETURNS TABLE(day date, projected_balance numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_balance numeric;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0)
  INTO start_balance
  FROM public.transactions
  WHERE user_id = _user_id AND occurred_at <= CURRENT_DATE;

  RETURN QUERY
  WITH days AS (
    SELECT generate_series(CURRENT_DATE, CURRENT_DATE + (_days || ' days')::interval, '1 day')::date AS d
  ),
  future AS (
    -- pending invoices
    SELECT due_date AS d, -total_amount AS delta
    FROM public.credit_card_invoices
    WHERE user_id = _user_id AND status <> 'paid' AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (_days || ' days')::interval
    UNION ALL
    -- recurrences
    SELECT next_run_at AS d, CASE WHEN type = 'income' THEN amount ELSE -amount END AS delta
    FROM public.recurrences
    WHERE user_id = _user_id AND active = true AND next_run_at BETWEEN CURRENT_DATE AND CURRENT_DATE + (_days || ' days')::interval
  )
  SELECT d.d,
    start_balance + COALESCE((SELECT SUM(delta) FROM future f WHERE f.d <= d.d), 0) AS projected_balance
  FROM days d
  ORDER BY d.d;
END;
$$;
