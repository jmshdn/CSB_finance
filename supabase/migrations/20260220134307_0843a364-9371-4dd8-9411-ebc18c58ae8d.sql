
-- Update close_month to skip auth check temporarily (until auth is added)
CREATE OR REPLACE FUNCTION public.close_month(_month_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- If no transactions, still create a summary
  IF NOT EXISTS (SELECT 1 FROM public.monthly_summaries WHERE month_id = _month_id) THEN
    INSERT INTO public.monthly_summaries (month_id, crypto_start, crypto_end)
    SELECT _month_id, m.crypto_start, m.crypto_end FROM public.months m WHERE m.id = _month_id;
  END IF;

  -- Mark month as closed
  UPDATE public.months SET is_closed = true, closed_at = now() WHERE id = _month_id;
END;
$$;
