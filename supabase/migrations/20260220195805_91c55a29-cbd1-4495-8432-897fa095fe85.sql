CREATE TABLE public.wallet_starting_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_id uuid NOT NULL REFERENCES public.months(id) ON DELETE CASCADE,
  wallet text NOT NULL,
  starting_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(month_id, wallet)
);

ALTER TABLE public.wallet_starting_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view wallet starting balances"
  ON public.wallet_starting_balances FOR SELECT USING (true);

CREATE POLICY "Admins can manage wallet starting balances"
  ON public.wallet_starting_balances FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anon can manage wallet starting balances"
  ON public.wallet_starting_balances FOR ALL USING (true);

CREATE TRIGGER update_wallet_starting_balances_updated_at
  BEFORE UPDATE ON public.wallet_starting_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();