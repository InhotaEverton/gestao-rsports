
-- Enum para categoria de pessoa
CREATE TYPE public.person_category AS ENUM ('aluno', 'socio', 'metodo');
CREATE TYPE public.person_status AS ENUM ('ativo', 'inativo');
CREATE TYPE public.payment_status AS ENUM ('pendente', 'pago', 'atrasado');

-- Tabela unificada de pessoas (alunos, sócios, métodos)
CREATE TABLE public.people (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category person_category NOT NULL,
  full_name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  guardian_name TEXT,
  phone TEXT,
  address TEXT,
  enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  notes TEXT,
  status person_status NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_people_category ON public.people(category);
CREATE INDEX idx_people_status ON public.people(status);

-- Tabela de mensalidades
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  competence TEXT NOT NULL, -- ex: '2025-04'
  amount NUMERIC(10,2) NOT NULL DEFAULT 120.00,
  due_date DATE NOT NULL,
  status payment_status NOT NULL DEFAULT 'pendente',
  payment_date DATE,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_person ON public.payments(person_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_due_date ON public.payments(due_date);
CREATE INDEX idx_payments_payment_date ON public.payments(payment_date);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_people_updated BEFORE UPDATE ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: aplicação interna com login fixo no frontend.
-- Permitir acesso completo a anon e authenticated (app interno single-tenant).
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to people" ON public.people
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to payments" ON public.payments
  FOR ALL USING (true) WITH CHECK (true);
