CREATE OR REPLACE FUNCTION public.carry_forward_wallet_balances(_new_month_id uuid, _crypto_start numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _prev_month_id uuid;
  _wallet text;
  _prev_starting numeric;
  _prev_net numeric;
  _ending numeric;
BEGIN
  SELECT id INTO _prev_month_id
  FROM public.months
  WHERE start_date < (SELECT start_date FROM public.months WHERE id = _new_month_id)
    AND id != _new_month_id
  ORDER BY start_date DESC
  LIMIT 1;

  -- Store crypto_start on months table for reference
  -- but CSB wallet starting balance will be carried forward like other teams

  IF _prev_month_id IS NOT NULL THEN
    FOR _wallet IN
      SELECT DISTINCT w FROM (
        SELECT wallet AS w FROM public.wallet_starting_balances WHERE month_id = _prev_month_id
        UNION
        SELECT team AS w FROM public.transactions WHERE month_id = _prev_month_id
      ) sub
    LOOP
      SELECT COALESCE(starting_amount, 0) INTO _prev_starting
      FROM public.wallet_starting_balances
      WHERE month_id = _prev_month_id AND wallet = _wallet;

      IF NOT FOUND THEN
        _prev_starting := 0;
      END IF;

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

      _ending := _prev_starting + _prev_net;

      INSERT INTO public.wallet_starting_balances (month_id, wallet, starting_amount)
      VALUES (_new_month_id, _wallet, _ending)
      ON CONFLICT (month_id, wallet)
      DO UPDATE SET starting_amount = EXCLUDED.starting_amount;
    END LOOP;
  ELSE
    -- First month ever: set CSB from crypto_start
    INSERT INTO public.wallet_starting_balances (month_id, wallet, starting_amount)
    VALUES (_new_month_id, 'CSB', _crypto_start)
    ON CONFLICT (month_id, wallet)
    DO UPDATE SET starting_amount = EXCLUDED.starting_amount;
  END IF;
END;
$function$;