
-- Create salary_settings table
CREATE TABLE public.salary_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_id uuid NOT NULL REFERENCES public.months(id),
  base_fee_per_person numeric NOT NULL DEFAULT 0,
  team_target numeric NOT NULL DEFAULT 2500,
  base_rate numeric NOT NULL DEFAULT 0.15,
  below_target_rate numeric NOT NULL DEFAULT 0.13,
  top_performer_rate numeric NOT NULL DEFAULT 0.17,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(month_id)
);

ALTER TABLE public.salary_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage salary settings"
  ON public.salary_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view salary settings"
  ON public.salary_settings FOR SELECT
  USING (true);

CREATE POLICY "Anon can manage salary settings"
  ON public.salary_settings FOR ALL
  USING (true);

-- Create person_salary_balances table
CREATE TABLE public.person_salary_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person text NOT NULL,
  month_id uuid NOT NULL REFERENCES public.months(id),
  carry_forward_deficit numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(person, month_id)
);

ALTER TABLE public.person_salary_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage person salary balances"
  ON public.person_salary_balances FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view person salary balances"
  ON public.person_salary_balances FOR SELECT
  USING (true);

CREATE POLICY "Anon can manage person salary balances"
  ON public.person_salary_balances FOR ALL
  USING (true);

-- Update close_month function to compute salary deficits
CREATE OR REPLACE FUNCTION public.close_month(_month_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _prev_month_id uuid;
  _base_fee numeric;
  _team_target numeric;
  _base_rate numeric;
  _below_target_rate numeric;
  _top_performer_rate numeric;
BEGIN
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
    COALESCE(SUM(CASE WHEN t.income_expense = 'Income' THEN t.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN t.income_expense = 'Expense' THEN t.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN t.income_expense = 'Income' THEN t.amount ELSE 0 END), 0) +
    COALESCE(SUM(CASE WHEN t.income_expense = 'Expense' THEN t.amount ELSE 0 END), 0)
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

  IF NOT EXISTS (SELECT 1 FROM public.monthly_summaries WHERE month_id = _month_id) THEN
    INSERT INTO public.monthly_summaries (month_id, crypto_start, crypto_end)
    SELECT _month_id, m.crypto_start, m.crypto_end FROM public.months m WHERE m.id = _month_id;
  END IF;

  -- ===== SALARY DEFICIT COMPUTATION =====
  -- Get previous month
  SELECT id INTO _prev_month_id
  FROM public.months
  WHERE start_date < (SELECT start_date FROM public.months WHERE id = _month_id)
  ORDER BY start_date DESC
  LIMIT 1;

  -- Get salary settings (use defaults if not set)
  SELECT
    COALESCE(ss.base_fee_per_person, 0),
    COALESCE(ss.team_target, 2500),
    COALESCE(ss.base_rate, 0.15),
    COALESCE(ss.below_target_rate, 0.13),
    COALESCE(ss.top_performer_rate, 0.17)
  INTO _base_fee, _team_target, _base_rate, _below_target_rate, _top_performer_rate
  FROM public.salary_settings ss
  WHERE ss.month_id = _month_id;

  IF NOT FOUND THEN
    _base_fee := 0;
    _team_target := 2500;
    _base_rate := 0.15;
    _below_target_rate := 0.13;
    _top_performer_rate := 0.17;
  END IF;

  -- Compute and store deficits
  DELETE FROM public.person_salary_balances WHERE month_id = _month_id;

  INSERT INTO public.person_salary_balances (person, month_id, carry_forward_deficit)
  SELECT
    pms.person,
    _month_id,
    CASE
      WHEN (pms.revenue - _base_fee - COALESCE(prev.carry_forward_deficit, 0)) <= 0
      THEN ABS(pms.revenue - _base_fee - COALESCE(prev.carry_forward_deficit, 0))
      ELSE 0
    END
  FROM public.person_monthly_summaries pms
  LEFT JOIN public.person_salary_balances prev
    ON prev.person = pms.person AND prev.month_id = _prev_month_id
  WHERE pms.month_id = _month_id;

  -- Mark month as closed
  UPDATE public.months SET is_closed = true, closed_at = now() WHERE id = _month_id;
END;
$function$;
