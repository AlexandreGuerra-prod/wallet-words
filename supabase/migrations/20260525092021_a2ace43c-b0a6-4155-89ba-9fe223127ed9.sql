-- Enums
CREATE TYPE public.account_type AS ENUM ('checking','savings','cash','credit_card','investment');
CREATE TYPE public.recurrence_frequency AS ENUM ('weekly','monthly','yearly');
CREATE TYPE public.goal_status AS ENUM ('active','completed','archived');

-- accounts
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type public.account_type NOT NULL DEFAULT 'checking',
  institution text,
  color text NOT NULL DEFAULT '#4f46e5',
  closing_day smallint,
  due_day smallint,
  credit_limit numeric(14,2),
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounts" ON public.accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX accounts_user_idx ON public.accounts(user_id);

-- goals
CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  target_amount numeric(14,2) NOT NULL CHECK (target_amount > 0),
  current_amount numeric(14,2) NOT NULL DEFAULT 0,
  deadline date,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  status public.goal_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goals" ON public.goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX goals_user_idx ON public.goals(user_id);

-- recurrences
CREATE TABLE public.recurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  description text NOT NULL,
  type public.tx_type NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  frequency public.recurrence_frequency NOT NULL DEFAULT 'monthly',
  day_of_month smallint,
  next_run_at date NOT NULL DEFAULT CURRENT_DATE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recurrences" ON public.recurrences FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX recurrences_user_idx ON public.recurrences(user_id);

-- transactions: link to account & recurrence
ALTER TABLE public.transactions
  ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN recurrence_id uuid REFERENCES public.recurrences(id) ON DELETE SET NULL;
CREATE INDEX transactions_account_idx ON public.transactions(account_id);

-- timestamps trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER goals_touch BEFORE UPDATE ON public.goals
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- materialize recurrences function
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
  FOR r IN
    SELECT * FROM public.recurrences
    WHERE user_id = _user_id AND active = true AND next_run_at <= CURRENT_DATE
  LOOP
    -- loop while overdue (catch up if needed)
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