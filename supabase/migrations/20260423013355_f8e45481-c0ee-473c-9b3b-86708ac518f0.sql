-- Habilita Realtime para sincronização automática entre telas/usuários
ALTER TABLE public.people REPLICA IDENTITY FULL;
ALTER TABLE public.payments REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.people;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;