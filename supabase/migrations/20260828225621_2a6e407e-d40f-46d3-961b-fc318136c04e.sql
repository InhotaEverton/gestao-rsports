CREATE TABLE public.fee_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category person_category NOT NULL UNIQUE,
  amount numeric NOT NULL DEFAULT 120.00,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_settings TO anon;
GRANT ALL ON public.fee_settings TO service_role;

ALTER TABLE public.fee_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to fee_settings" ON public.fee_settings FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER trg_fee_settings_updated BEFORE UPDATE ON public.fee_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.fee_settings (category, amount) VALUES
  ('aluno', 120.00),
  ('socio', 120.00),
  ('metodo', 120.00);