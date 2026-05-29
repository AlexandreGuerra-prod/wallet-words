INSERT INTO public.categories (name, is_default, icon) VALUES
  ('Luz', true, '💡'),
  ('Tarifas bancárias', true, '🏦'),
  ('Juros', true, '📈'),
  ('Empréstimos', true, '🏧'),
  ('Transferências', true, '🔁'),
  ('Pix recebido', true, '💸'),
  ('Telefonia', true, '📱'),
  ('Aluguel', true, '🏠')
ON CONFLICT DO NOTHING;