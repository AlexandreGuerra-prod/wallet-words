-- Compras parceladas
CREATE TABLE public.installment_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  description TEXT NOT NULL,
  total_amount NUMERIC NOT NULL CHECK (total_amount > 0),
  installments_count SMALLINT NOT NULL CHECK (installments_count BETWEEN 1 AND 360),
  first_due_date DATE NOT NULL,
  account_id UUID,
  category_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.installment_purchases TO authenticated;
GRANT ALL ON public.installment_purchases TO service_role;

ALTER TABLE public.installment_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own installment_purchases"
ON public.installment_purchases FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER installment_purchases_touch
BEFORE UPDATE ON public.installment_purchases
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Parcelas individuais
CREATE TABLE public.installment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.installment_purchases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  number SMALLINT NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (purchase_id, number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.installment_items TO authenticated;
GRANT ALL ON public.installment_items TO service_role;

ALTER TABLE public.installment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own installment_items"
ON public.installment_items FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_installment_items_purchase ON public.installment_items(purchase_id);
CREATE INDEX idx_installment_items_user_due ON public.installment_items(user_id, due_date);
CREATE INDEX idx_installment_purchases_user ON public.installment_purchases(user_id, account_id);