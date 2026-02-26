
CREATE OR REPLACE FUNCTION public.carry_forward_wallet_balances(_new_month_id uuid, _crypto_start numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _prev_month_id uuid;
  _wallet text;
  _prev_starting numeric;
  _prev_net numeric;
  _ending numeric;
BEGIN
  -- Find the previous month by start_date
  SELECT id INTO _prev_month_id
  FROM public.months
  WHERE start_date < (SELECT start_date FROM public.months WHERE id = _new_month_id)
    AND id != _new_month_id
  ORDER BY start_date DESC
  LIMIT 1;

  -- Always set CSB wallet starting balance from crypto_start
  INSERT INTO public.wallet_starting_balances (month_id, wallet, starting_amount)
  VALUES (_new_month_id, 'CSB', _crypto_start)
  ON CONFLICT (month_id, wallet)
  DO UPDATE SET starting_amount = EXCLUDED.starting_amount;

  -- If there's a previous month, carry forward all wallet balances
  IF _prev_month_id IS NOT NULL THEN
    -- For each wallet that had a starting balance in the previous month
    FOR _wallet IN
      SELECT DISTINCT w.wallet FROM public.wallet_starting_balances w WHERE w.month_id = _prev_month_id
    LOOP
      -- Get previous starting amount
      SELECT COALESCE(starting_amount, 0) INTO _prev_starting
      FROM public.wallet_starting_balances
      WHERE month_id = _prev_month_id AND wallet = _wallet;

      -- Calculate net transactions for that wallet in previous month
      IF _wallet = 'CSB' THEN
        -- CSB net: internal received - internal sent - external expenses - base fees
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
        -- Team wallets: sum all non-Cash transactions
        SELECT COALESCE(SUM(amount), 0) INTO _prev_net
        FROM public.transactions
        WHERE month_id = _prev_month_id AND team = _wallet AND income_expense != 'Cash';
      END IF;

      _ending := _prev_starting + _prev_net;

      -- CSB already handled above with crypto_start, skip
      IF _wallet != 'CSB' THEN
        INSERT INTO public.wallet_starting_balances (month_id, wallet, starting_amount)
        VALUES (_new_month_id, _wallet, _ending)
        ON CONFLICT (month_id, wallet)
        DO UPDATE SET starting_amount = EXCLUDED.starting_amount;
      END IF;
    END LOOP;
  END IF;
END;
$$;
