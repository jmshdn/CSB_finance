-- Add carry_forward_amount column to wallet_starting_balances
ALTER TABLE public.wallet_starting_balances
ADD COLUMN carry_forward_amount numeric NOT NULL DEFAULT 0;

-- Update the carry_forward_wallet_balances RPC to write to carry_forward_amount instead of starting_amount
CREATE OR REPLACE FUNCTION public.carry_forward_wallet_balances(_new_month_id uuid, _crypto_start numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prev_month_id uuid;
  _wallet text;
  _prev_starting numeric;
  _prev_carry_forward numeric;
  _prev_net numeric;
  _ending numeric;
BEGIN
  SELECT id INTO _prev_month_id
  FROM public.months
  WHERE start_date < (SELECT start_date FROM public.months WHERE id = _new_month_id)
    AND id != _new_month_id
  ORDER BY start_date DESC
  LIMIT 1;

  IF _prev_month_id IS NOT NULL THEN
    FOR _wallet IN
      SELECT DISTINCT w FROM (
        SELECT wallet AS w FROM public.wallet_starting_balances WHERE month_id = _prev_month_id
        UNION
        SELECT team AS w FROM public.transactions WHERE month_id = _prev_month_id
      ) sub
    LOOP
      -- Get previous month's starting_amount and carry_forward_amount
      SELECT COALESCE(starting_amount, 0), COALESCE(carry_forward_amount, 0)
      INTO _prev_starting, _prev_carry_forward
      FROM public.wallet_starting_balances
      WHERE month_id = _prev_month_id AND wallet = _wallet;

      IF NOT FOUND THEN
        _prev_starting := 0;
        _prev_carry_forward := 0;
      END IF;

      -- Calculate net transactions (same logic as before)
      IF _wallet = 'CSB' THEN
        SELECT COALESCE(SUM(
          CASE
            WHEN income_expense = 'Internal' THEN amount
            WHEN income_expense = 'Expense' THEN amount
            ELSE 0
          END
        ), 0) INTO _prev_net
        FROM public.transactions
        WHERE month_id = _prev_month_id AND team = 'CSB' AND income_expense != 'Cash';
      ELSE
        SELECT COALESCE(SUM(amount), 0) INTO _prev_net
        FROM public.transactions
        WHERE month_id = _prev_month_id AND team = _wallet AND income_expense != 'Cash';
      END IF;

      -- Ending = carry_forward + starting_amount + net
      _ending := _prev_carry_forward + _prev_starting + _prev_net;

      -- Write to carry_forward_amount (NOT starting_amount)
      INSERT INTO public.wallet_starting_balances (month_id, wallet, starting_amount, carry_forward_amount)
      VALUES (_new_month_id, _wallet, 0, _ending)
      ON CONFLICT (month_id, wallet)
      DO UPDATE SET carry_forward_amount = EXCLUDED.carry_forward_amount, starting_amount = 0;
    END LOOP;
  ELSE
    -- First month: set CSB carry_forward from crypto_start
    INSERT INTO public.wallet_starting_balances (month_id, wallet, starting_amount, carry_forward_amount)
    VALUES (_new_month_id, 'CSB', 0, _crypto_start)
    ON CONFLICT (month_id, wallet)
    DO UPDATE SET carry_forward_amount = EXCLUDED.carry_forward_amount, starting_amount = 0;
  END IF;
END;
$$;