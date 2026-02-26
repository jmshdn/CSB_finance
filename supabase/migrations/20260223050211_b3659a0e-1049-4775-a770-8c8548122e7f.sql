
-- Drop the restrictive team-only view policies
DROP POLICY IF EXISTS "Team users can view own wallet transactions" ON public.transactions;
DROP POLICY IF EXISTS "Team users can view CSB transactions for their members" ON public.transactions;

-- Allow all authenticated users to view all transactions
CREATE POLICY "Authenticated users can view all transactions"
ON public.transactions
FOR SELECT
USING (auth.uid() IS NOT NULL);
