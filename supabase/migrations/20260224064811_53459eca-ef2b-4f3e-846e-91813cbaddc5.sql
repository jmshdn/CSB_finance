
-- Add settlement fields to transactions table
ALTER TABLE public.transactions
  ADD COLUMN source_type text DEFAULT NULL,
  ADD COLUMN settlement_status text DEFAULT NULL,
  ADD COLUMN settled_amount numeric DEFAULT NULL,
  ADD COLUMN settlement_month_id uuid DEFAULT NULL REFERENCES public.months(id),
  ADD COLUMN original_transaction_id uuid DEFAULT NULL REFERENCES public.transactions(id);

-- Create index for pending settlement queries
CREATE INDEX idx_transactions_settlement_status ON public.transactions(settlement_status) WHERE settlement_status IS NOT NULL;
CREATE INDEX idx_transactions_original_transaction_id ON public.transactions(original_transaction_id) WHERE original_transaction_id IS NOT NULL;
