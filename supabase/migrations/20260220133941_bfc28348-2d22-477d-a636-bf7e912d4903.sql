
-- Fix months SELECT policy to be permissive
DROP POLICY IF EXISTS "Anyone authenticated can view months" ON public.months;
CREATE POLICY "Anyone authenticated can view months"
  ON public.months FOR SELECT TO authenticated
  USING (true);

-- Fix monthly_summaries SELECT policy
DROP POLICY IF EXISTS "Anyone authenticated can view monthly summaries" ON public.monthly_summaries;
CREATE POLICY "Anyone authenticated can view monthly summaries"
  ON public.monthly_summaries FOR SELECT TO authenticated
  USING (true);

-- Fix person_monthly_summaries SELECT policy
DROP POLICY IF EXISTS "Anyone authenticated can view person monthly summaries" ON public.person_monthly_summaries;
CREATE POLICY "Anyone authenticated can view person monthly summaries"
  ON public.person_monthly_summaries FOR SELECT TO authenticated
  USING (true);

-- Fix transactions SELECT policies to be permissive
DROP POLICY IF EXISTS "Team users can view own wallet transactions" ON public.transactions;
CREATE POLICY "Team users can view own wallet transactions"
  ON public.transactions FOR SELECT TO authenticated
  USING (team = get_user_wallet(auth.uid()));

DROP POLICY IF EXISTS "Team users can view CSB transactions for their members" ON public.transactions;
CREATE POLICY "Team users can view CSB transactions for their members"
  ON public.transactions FOR SELECT TO authenticated
  USING (team = 'CSB' AND EXISTS (
    SELECT 1 FROM team_persons tp
    WHERE tp.team = get_user_wallet(auth.uid()) AND tp.person_name = transactions.person
  ));

-- Fix team_persons SELECT
DROP POLICY IF EXISTS "Anyone authenticated can view team persons" ON public.team_persons;
CREATE POLICY "Anyone authenticated can view team persons"
  ON public.team_persons FOR SELECT TO authenticated
  USING (true);
