
-- Allow anon to read months (public data, no PII)
CREATE POLICY "Anyone can view months"
  ON public.months FOR SELECT TO anon
  USING (true);

-- Allow anon to read team_persons (public roster data)
CREATE POLICY "Anyone can view team persons anon"
  ON public.team_persons FOR SELECT TO anon
  USING (true);

-- Allow anon to read monthly_summaries
CREATE POLICY "Anyone can view monthly summaries anon"
  ON public.monthly_summaries FOR SELECT TO anon
  USING (true);

-- Allow anon to read person_monthly_summaries
CREATE POLICY "Anyone can view person monthly summaries anon"
  ON public.person_monthly_summaries FOR SELECT TO anon
  USING (true);

-- Allow anon to read/write transactions temporarily (until auth is added)
CREATE POLICY "Anon can view transactions"
  ON public.transactions FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anon can insert transactions"
  ON public.transactions FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update transactions"
  ON public.transactions FOR UPDATE TO anon
  USING (true);

CREATE POLICY "Anon can delete transactions"
  ON public.transactions FOR DELETE TO anon
  USING (true);

-- Allow anon admin operations on months (for close/create)
CREATE POLICY "Anon can manage months"
  ON public.months FOR ALL TO anon
  USING (true);
