
ALTER TABLE public.wallet_starting_balances
ADD COLUMN real_balance numeric DEFAULT NULL,
ADD COLUMN real_balance_date date DEFAULT NULL;
