
-- 1. Create months table
CREATE TABLE public.months (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  closed_at TIMESTAMP WITH TIME ZONE,
  crypto_start NUMERIC NOT NULL DEFAULT 0,
  crypto_end NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.months ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view months"
  ON public.months FOR SELECT USING (true);

CREATE POLICY "Admins can manage months"
  ON public.months FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Add month_id to transactions
ALTER TABLE public.transactions ADD COLUMN month_id UUID REFERENCES public.months(id);

-- 3. Drop old summary tables and recreate
DROP TABLE IF EXISTS public.monthly_summaries;
DROP TABLE IF EXISTS public.person_summaries;

CREATE TABLE public.monthly_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month_id UUID NOT NULL REFERENCES public.months(id),
  total_income NUMERIC NOT NULL DEFAULT 0,
  total_expense NUMERIC NOT NULL DEFAULT 0,
  base_fee NUMERIC NOT NULL DEFAULT 0,
  crypto_start NUMERIC NOT NULL DEFAULT 0,
  crypto_end NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(month_id)
);

ALTER TABLE public.monthly_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view monthly summaries"
  ON public.monthly_summaries FOR SELECT USING (true);

CREATE POLICY "Admins can manage monthly summaries"
  ON public.monthly_summaries FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Create person_monthly_summaries
CREATE TABLE public.person_monthly_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month_id UUID NOT NULL REFERENCES public.months(id),
  person TEXT NOT NULL,
  income NUMERIC NOT NULL DEFAULT 0,
  expense NUMERIC NOT NULL DEFAULT 0,
  revenue NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(month_id, person)
);

ALTER TABLE public.person_monthly_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view person monthly summaries"
  ON public.person_monthly_summaries FOR SELECT USING (true);

CREATE POLICY "Admins can manage person monthly summaries"
  ON public.person_monthly_summaries FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Prevent transactions in closed months (validation trigger)
CREATE OR REPLACE FUNCTION public.check_month_not_closed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.month_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.months WHERE id = NEW.month_id AND is_closed = true
  ) THEN
    RAISE EXCEPTION 'Cannot modify transactions in a closed month';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_closed_month_insert
  BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.check_month_not_closed();

CREATE TRIGGER prevent_closed_month_update
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.check_month_not_closed();

-- Also prevent deletion in closed months
CREATE OR REPLACE FUNCTION public.check_month_not_closed_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.month_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.months WHERE id = OLD.month_id AND is_closed = true
  ) THEN
    RAISE EXCEPTION 'Cannot delete transactions in a closed month';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER prevent_closed_month_delete
  BEFORE DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.check_month_not_closed_delete();

-- 6. Close month function (generates summaries + locks)
CREATE OR REPLACE FUNCTION public.close_month(_month_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_admin BOOLEAN;
BEGIN
  SELECT has_role(auth.uid(), 'admin'::app_role) INTO _is_admin;
  IF NOT _is_admin THEN
    RAISE EXCEPTION 'Only admins can close months';
  END IF;

  -- Check month exists and is open
  IF NOT EXISTS (SELECT 1 FROM public.months WHERE id = _month_id AND is_closed = false) THEN
    RAISE EXCEPTION 'Month not found or already closed';
  END IF;

  -- Generate person_monthly_summaries
  DELETE FROM public.person_monthly_summaries WHERE month_id = _month_id;
  INSERT INTO public.person_monthly_summaries (month_id, person, income, expense, revenue)
  SELECT
    _month_id,
    t.person,
    COALESCE(SUM(CASE WHEN t.income_expense = 'Income' THEN t.amount ELSE 0 END), 0) AS income,
    COALESCE(SUM(CASE WHEN t.income_expense = 'Expense' THEN t.amount ELSE 0 END), 0) AS expense,
    COALESCE(SUM(CASE WHEN t.income_expense = 'Income' THEN t.amount ELSE 0 END), 0) +
    COALESCE(SUM(CASE WHEN t.income_expense = 'Expense' THEN t.amount ELSE 0 END), 0) AS revenue
  FROM public.transactions t
  WHERE t.month_id = _month_id
    AND t.income_expense IN ('Income', 'Expense')
    AND t.person NOT IN ('Internal', 'Team', 'All')
    AND t.type NOT IN ('Internal', 'Withdraw')
  GROUP BY t.person;

  -- Generate monthly_summaries
  DELETE FROM public.monthly_summaries WHERE month_id = _month_id;
  INSERT INTO public.monthly_summaries (month_id, total_income, total_expense, base_fee, crypto_start, crypto_end)
  SELECT
    _month_id,
    COALESCE(SUM(CASE WHEN t.income_expense = 'Income' THEN t.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN t.income_expense = 'Expense' THEN ABS(t.amount) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN t.type = 'Base fee' THEN ABS(t.amount) ELSE 0 END), 0),
    m.crypto_start,
    m.crypto_end
  FROM public.transactions t
  CROSS JOIN public.months m
  WHERE t.month_id = _month_id
    AND m.id = _month_id
    AND t.income_expense IN ('Income', 'Expense')
  GROUP BY m.crypto_start, m.crypto_end;

  -- Mark month as closed
  UPDATE public.months SET is_closed = true, closed_at = now() WHERE id = _month_id;
END;
$$;
