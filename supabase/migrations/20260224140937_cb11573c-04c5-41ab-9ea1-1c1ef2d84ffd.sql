CREATE OR REPLACE FUNCTION public.check_month_not_closed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.month_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.months WHERE id = NEW.month_id AND is_closed = true
  ) THEN
    -- Allow settlement-related updates on closed months
    IF TG_OP = 'UPDATE'
       AND (OLD.settlement_status IS DISTINCT FROM NEW.settlement_status
            OR OLD.settled_amount IS DISTINCT FROM NEW.settled_amount
            OR OLD.settlement_month_id IS DISTINCT FROM NEW.settlement_month_id)
       AND OLD.date = NEW.date
       AND OLD.amount = NEW.amount
       AND OLD.person = NEW.person
       AND OLD.team = NEW.team
       AND OLD.type = NEW.type
       AND OLD.income_expense = NEW.income_expense
    THEN
      RETURN NEW;
    END IF;
    -- Allow inserting Settlement Adjustment transactions into closed months
    IF TG_OP = 'INSERT' AND NEW.type = 'Settlement Adjustment' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot modify transactions in a closed month';
  END IF;
  RETURN NEW;
END;
$function$;