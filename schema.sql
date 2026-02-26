-- ============================================================
-- CSB FINANCE — Full PostgreSQL Export
-- Generated: 2026-02-24
-- ============================================================

-- ===================== ENUM TYPES =====================
CREATE TYPE app_role AS ENUM ('admin', 'team_user');

-- ===================== TABLES =====================

CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE team_persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team text NOT NULL,
  person_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team, person_name)
);

CREATE TABLE months (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_closed boolean NOT NULL DEFAULT false,
  closed_at timestamptz,
  crypto_start numeric NOT NULL DEFAULT 0,
  crypto_end numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  display_name text NOT NULL,
  assigned_wallet text,
  is_active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  theme text NOT NULL DEFAULT 'system',
  compact_mode boolean NOT NULL DEFAULT false,
  default_landing_page text NOT NULL DEFAULT '/overview',
  default_month text,
  dashboard_layout text NOT NULL DEFAULT 'default',
  currency_format text NOT NULL DEFAULT 'USD',
  table_density text NOT NULL DEFAULT 'normal',
  accent_color text NOT NULL DEFAULT 'blue',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id text NOT NULL,
  date date NOT NULL,
  amount numeric NOT NULL,
  team text NOT NULL,
  income_expense text NOT NULL,
  type text NOT NULL,
  category text,
  person text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  source_type text,
  linked_wallet text,
  month_id uuid REFERENCES months(id),
  created_by uuid,
  settlement_status text,
  settled_amount numeric,
  settlement_month_id uuid REFERENCES months(id),
  original_transaction_id uuid REFERENCES transactions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE monthly_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_id uuid NOT NULL UNIQUE REFERENCES months(id),
  total_income numeric NOT NULL DEFAULT 0,
  total_expense numeric NOT NULL DEFAULT 0,
  base_fee numeric NOT NULL DEFAULT 0,
  crypto_start numeric NOT NULL DEFAULT 0,
  crypto_end numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE person_monthly_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_id uuid NOT NULL REFERENCES months(id),
  person text NOT NULL,
  income numeric NOT NULL DEFAULT 0,
  expense numeric NOT NULL DEFAULT 0,
  revenue numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (month_id, person)
);

CREATE TABLE person_salary_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person text NOT NULL,
  month_id uuid NOT NULL REFERENCES months(id),
  carry_forward_deficit numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person, month_id)
);

CREATE TABLE salary_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_id uuid NOT NULL UNIQUE REFERENCES months(id),
  base_fee_per_person numeric NOT NULL DEFAULT 0,
  team_target numeric NOT NULL DEFAULT 2500,
  base_rate numeric NOT NULL DEFAULT 0.15,
  below_target_rate numeric NOT NULL DEFAULT 0.13,
  top_performer_rate numeric NOT NULL DEFAULT 0.17,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wallet_starting_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_id uuid NOT NULL REFERENCES months(id) ON DELETE CASCADE,
  wallet text NOT NULL,
  starting_amount numeric NOT NULL DEFAULT 0,
  carry_forward_amount numeric NOT NULL DEFAULT 0,
  real_balance numeric,
  real_balance_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (month_id, wallet)
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY['info','warning','security']))
);

CREATE TABLE activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  details text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE custom_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, type),
  CONSTRAINT custom_categories_type_check CHECK (type = ANY (ARRAY['Income','Expense']))
);

-- ===================== INDEXES =====================

CREATE INDEX idx_activity_logs_created_at ON activity_logs (created_at DESC);
CREATE INDEX idx_activity_logs_user_id ON activity_logs (user_id);
CREATE INDEX idx_notifications_user_id ON notifications (user_id);
CREATE INDEX idx_notifications_is_read ON notifications (user_id, is_read);
CREATE INDEX idx_transactions_original_transaction_id ON transactions (original_transaction_id) WHERE original_transaction_id IS NOT NULL;
CREATE INDEX idx_transactions_settlement_status ON transactions (settlement_status) WHERE settlement_status IS NOT NULL;

-- ===================== FUNCTIONS =====================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION get_user_wallet(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT assigned_wallet FROM public.profiles WHERE user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION check_month_not_closed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.month_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.months WHERE id = NEW.month_id AND is_closed = true
  ) THEN
    IF TG_OP = 'UPDATE'
       AND (OLD.settlement_status IS DISTINCT FROM NEW.settlement_status
            OR OLD.settled_amount IS DISTINCT FROM NEW.settled_amount
            OR OLD.settlement_month_id IS DISTINCT FROM NEW.settlement_month_id)
       AND OLD.date = NEW.date AND OLD.amount = NEW.amount
       AND OLD.person = NEW.person AND OLD.team = NEW.team
       AND OLD.type = NEW.type AND OLD.income_expense = NEW.income_expense
    THEN RETURN NEW; END IF;
    IF TG_OP = 'INSERT' AND NEW.type = 'Settlement Adjustment' THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Cannot modify transactions in a closed month';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION check_month_not_closed_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.month_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.months WHERE id = OLD.month_id AND is_closed = true
  ) THEN
    RAISE EXCEPTION 'Cannot delete transactions in a closed month';
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION carry_forward_wallet_balances(_new_month_id uuid, _crypto_start numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
  ORDER BY start_date DESC LIMIT 1;

  IF _prev_month_id IS NOT NULL THEN
    FOR _wallet IN
      SELECT DISTINCT w FROM (
        SELECT wallet AS w FROM public.wallet_starting_balances WHERE month_id = _prev_month_id
        UNION
        SELECT team AS w FROM public.transactions WHERE month_id = _prev_month_id
      ) sub
    LOOP
      SELECT COALESCE(starting_amount, 0), COALESCE(carry_forward_amount, 0)
      INTO _prev_starting, _prev_carry_forward
      FROM public.wallet_starting_balances
      WHERE month_id = _prev_month_id AND wallet = _wallet;
      IF NOT FOUND THEN _prev_starting := 0; _prev_carry_forward := 0; END IF;

      IF _wallet = 'CSB' THEN
        SELECT COALESCE(SUM(CASE WHEN income_expense = 'Internal' THEN amount WHEN income_expense = 'Expense' THEN amount ELSE 0 END), 0)
        INTO _prev_net FROM public.transactions
        WHERE month_id = _prev_month_id AND team = 'CSB' AND income_expense != 'Cash';
      ELSE
        SELECT COALESCE(SUM(amount), 0) INTO _prev_net
        FROM public.transactions WHERE month_id = _prev_month_id AND team = _wallet AND income_expense != 'Cash';
      END IF;

      _ending := _prev_carry_forward + _prev_starting + _prev_net;
      INSERT INTO public.wallet_starting_balances (month_id, wallet, starting_amount, carry_forward_amount)
      VALUES (_new_month_id, _wallet, 0, _ending)
      ON CONFLICT (month_id, wallet)
      DO UPDATE SET carry_forward_amount = EXCLUDED.carry_forward_amount, starting_amount = 0;
    END LOOP;
  ELSE
    INSERT INTO public.wallet_starting_balances (month_id, wallet, starting_amount, carry_forward_amount)
    VALUES (_new_month_id, 'CSB', 0, _crypto_start)
    ON CONFLICT (month_id, wallet)
    DO UPDATE SET carry_forward_amount = EXCLUDED.carry_forward_amount, starting_amount = 0;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION close_month(_month_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _prev_month_id uuid;
  _base_fee numeric;
  _team_target numeric;
  _base_rate numeric;
  _below_target_rate numeric;
  _top_performer_rate numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.months WHERE id = _month_id AND is_closed = false) THEN
    RAISE EXCEPTION 'Month not found or already closed';
  END IF;

  DELETE FROM public.person_monthly_summaries WHERE month_id = _month_id;
  INSERT INTO public.person_monthly_summaries (month_id, person, income, expense, revenue)
  SELECT _month_id, t.person,
    COALESCE(SUM(CASE WHEN t.income_expense = 'Income' THEN t.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN t.income_expense = 'Expense' THEN t.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN t.income_expense = 'Income' THEN t.amount ELSE 0 END), 0) +
    COALESCE(SUM(CASE WHEN t.income_expense = 'Expense' THEN t.amount ELSE 0 END), 0)
  FROM public.transactions t
  WHERE t.month_id = _month_id AND t.income_expense IN ('Income', 'Expense')
    AND t.person NOT IN ('Internal', 'Team', 'All')
    AND t.type NOT IN ('Internal', 'Withdraw')
  GROUP BY t.person;

  DELETE FROM public.monthly_summaries WHERE month_id = _month_id;
  INSERT INTO public.monthly_summaries (month_id, total_income, total_expense, base_fee, crypto_start, crypto_end)
  SELECT _month_id,
    COALESCE(SUM(CASE WHEN t.income_expense = 'Income' THEN t.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN t.income_expense = 'Expense' THEN ABS(t.amount) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN t.type = 'Base fee' THEN ABS(t.amount) ELSE 0 END), 0),
    m.crypto_start, m.crypto_end
  FROM public.transactions t CROSS JOIN public.months m
  WHERE t.month_id = _month_id AND m.id = _month_id AND t.income_expense IN ('Income', 'Expense')
  GROUP BY m.crypto_start, m.crypto_end;

  IF NOT EXISTS (SELECT 1 FROM public.monthly_summaries WHERE month_id = _month_id) THEN
    INSERT INTO public.monthly_summaries (month_id, crypto_start, crypto_end)
    SELECT _month_id, m.crypto_start, m.crypto_end FROM public.months m WHERE m.id = _month_id;
  END IF;

  SELECT id INTO _prev_month_id FROM public.months
  WHERE start_date < (SELECT start_date FROM public.months WHERE id = _month_id)
  ORDER BY start_date DESC LIMIT 1;

  SELECT COALESCE(ss.base_fee_per_person, 0), COALESCE(ss.team_target, 2500),
    COALESCE(ss.base_rate, 0.15), COALESCE(ss.below_target_rate, 0.13), COALESCE(ss.top_performer_rate, 0.17)
  INTO _base_fee, _team_target, _base_rate, _below_target_rate, _top_performer_rate
  FROM public.salary_settings ss WHERE ss.month_id = _month_id;
  IF NOT FOUND THEN
    _base_fee := 0; _team_target := 2500; _base_rate := 0.15; _below_target_rate := 0.13; _top_performer_rate := 0.17;
  END IF;

  DELETE FROM public.person_salary_balances WHERE month_id = _month_id;
  INSERT INTO public.person_salary_balances (person, month_id, carry_forward_deficit)
  SELECT pms.person, _month_id,
    CASE WHEN (pms.revenue - _base_fee - COALESCE(prev.carry_forward_deficit, 0)) <= 0
      THEN ABS(pms.revenue - _base_fee - COALESCE(prev.carry_forward_deficit, 0)) ELSE 0 END
  FROM public.person_monthly_summaries pms
  LEFT JOIN public.person_salary_balances prev ON prev.person = pms.person AND prev.month_id = _prev_month_id
  WHERE pms.month_id = _month_id;

  UPDATE public.months SET is_closed = true, closed_at = now() WHERE id = _month_id;
END;
$$;

-- ===================== TRIGGERS =====================
-- (Attach these after creating tables. The handle_new_user trigger
--  goes on auth.users which is Supabase-managed; for local Postgres
--  you'll need your own auth.users table or skip it.)

CREATE TRIGGER trg_check_month_not_closed
  BEFORE INSERT OR UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION check_month_not_closed();

CREATE TRIGGER trg_check_month_not_closed_delete
  BEFORE DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION check_month_not_closed_delete();

CREATE TRIGGER trg_update_updated_at_transactions
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_updated_at_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_updated_at_user_preferences
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_updated_at_wallet_starting_balances
  BEFORE UPDATE ON wallet_starting_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================== DATA =====================

-- teams
INSERT INTO teams (id, name, created_at) VALUES
  ('6d1031d8-7192-4d5a-a8a5-3daf7e005a47', 'AAA', '2026-02-24 18:36:24.485732+00'),
  ('8f3b0fd4-6655-49bc-bbaf-c310483ea732', 'BBB', '2026-02-24 18:36:24.485732+00'),
  ('a7ca8dac-3adf-4f5d-82ba-dbe358f07ba5', 'CCC', '2026-02-24 18:36:24.485732+00'),
  ('7e3bcd11-8b4d-4cc2-b52e-c32f3bb022cc', 'DDD', '2026-02-24 18:36:24.485732+00'),
  ('49d6229e-bb34-4b76-8e2e-c222e28c2d7d', 'EEE', '2026-02-24 18:36:24.485732+00'),
  ('a4543e59-6186-47b1-85d9-f9eaea12e890', 'CSB', '2026-02-24 18:36:24.485732+00');

-- team_persons
INSERT INTO team_persons (id, team, person_name, created_at) VALUES
  ('5c2f3ea7-78ba-4d86-9ca5-386150e61f3e', 'AAA', 'HSJ', '2026-02-24 13:37:50.440096+00'),
  ('d0673f89-3d82-437e-9336-d0656105a71a', 'AAA', 'JJS', '2026-02-24 13:37:56.853079+00'),
  ('22b4ed78-a99d-467b-b5a1-94eb2681a645', 'AAA', 'KRS', '2026-02-24 13:38:00.980761+00'),
  ('b393a880-edca-4676-8486-e5baadd49537', 'AAA', 'RCJ', '2026-02-24 13:38:10.489762+00'),
  ('6c178de3-20c9-4f8b-9164-57b6fe861e4a', 'AAA', 'KNI', '2026-02-24 18:44:47.626103+00'),
  ('6263604b-6e3e-46eb-897c-cc408505630c', 'BBB', 'JJI', '2026-02-24 13:38:22.467819+00'),
  ('2e4fa3a5-9741-4834-9009-aa5ae002c5b6', 'BBB', 'RCS', '2026-02-24 13:38:41.827396+00'),
  ('f91e2654-1369-4780-ba4d-ee46ac26b056', 'BBB', 'PBM', '2026-02-24 13:39:08.173833+00'),
  ('e2b9925b-8535-43cc-97ef-56a196ced887', 'BBB', 'SHN', '2026-02-24 13:39:21.39106+00'),
  ('648c1b45-e9fb-4ee4-b44d-b4f54a76d478', 'CCC', 'KCG', '2026-02-24 13:39:27.052724+00'),
  ('23e085c3-f193-47f4-9f3b-c8cdc132d7d4', 'CCC', 'MDS', '2026-02-24 13:39:40.025306+00'),
  ('10b50ccd-954e-4c38-b08e-fa00d9bbfb56', 'CCC', 'HTR', '2026-02-24 13:39:45.02846+00'),
  ('9c6693b0-98ed-43e0-b7bf-3d69161a842a', 'CCC', 'YCS', '2026-02-24 13:48:08.534228+00'),
  ('7cc211d1-9020-488e-9c0f-1a97541a72bd', 'CCC', 'PMG', '2026-02-24 13:48:22.282731+00'),
  ('131ec6f5-f4ed-46a3-8602-e7f4b5d0aa38', 'DDD', 'NSJ', '2026-02-24 13:48:31.071844+00'),
  ('f463bf06-1269-4ecf-a814-a836dd6ac8ae', 'DDD', 'RGB', '2026-02-24 13:48:34.648593+00'),
  ('4769f7a2-0df4-4188-9cdc-5dfe896b373f', 'DDD', 'STI', '2026-02-24 13:48:38.300569+00'),
  ('5bf6ac78-2d98-4f88-9b38-d344d1198057', 'DDD', 'JSH', '2026-02-24 18:06:34.018335+00'),
  ('9f31c731-c46f-4454-97ff-1c044ec9b7bf', 'EEE', 'KGJ', '2026-02-24 13:48:42.48935+00'),
  ('5ae09456-1241-4f47-91e7-3782e3277432', 'EEE', 'SRH', '2026-02-24 13:48:47.388907+00'),
  ('eea600b0-19e1-4adb-8c84-790246521b56', 'EEE', 'JGS', '2026-02-24 13:48:50.72651+00'),
  ('48360579-a2e4-4afd-a9e5-98851f617228', 'EEE', 'KSM', '2026-02-24 13:48:53.989549+00');

-- profiles (NOTE: user_id references auth.users; for local use, remove the FK or create a local users table)
INSERT INTO profiles (id, user_id, display_name, assigned_wallet, is_active, must_change_password, created_at, updated_at) VALUES
  ('f91a0eae-c447-40db-b623-72fd58e9606c', '7c2e2b7b-479b-4822-8a3a-350ef5b89834', 'KNI', 'AAA', true, true, '2026-02-23 04:01:10.64055+00', '2026-02-23 04:01:10.90335+00'),
  ('3b32eb70-9766-436b-ba80-de3068172460', '56d73d23-b9dc-47f7-9283-87d225f3389c', 'HSJ', 'AAA', true, true, '2026-02-23 04:01:11.905417+00', '2026-02-23 04:01:12.146399+00'),
  ('cf4bc7b4-a66b-43fb-8cdf-abf1dd8f29ed', '0894a56d-8891-446c-95d0-909736e6a22b', 'JJS', 'AAA', true, false, '2026-02-23 04:01:11.179218+00', '2026-02-23 04:01:53.101067+00'),
  ('fa88458f-b1b2-403b-8a83-a29436400731', '1569a0c7-a188-4993-a8f9-5de7a50c0370', 'RCJ', 'AAA', true, true, '2026-02-23 04:01:12.425797+00', '2026-02-23 04:01:12.629999+00'),
  ('ba4a921a-171c-4ff5-8914-8b493b404004', '7e36ffa9-449c-4140-a35a-f38cafdaf291', 'KRS', 'AAA', true, true, '2026-02-23 04:01:12.898479+00', '2026-02-23 04:01:13.097339+00'),
  ('13dbf5f4-3d4a-4e97-8250-3553c22b78dd', '0e0f9cbe-1237-4c69-a2ca-c5451602cf71', 'SHN', 'BBB', true, true, '2026-02-23 04:01:13.372373+00', '2026-02-23 04:01:13.576039+00'),
  ('e8bfeb13-9fef-4a27-850e-503878808139', '6f5719da-a4cb-40be-b516-ea02c104786f', 'PBM', 'BBB', true, true, '2026-02-23 04:01:13.855572+00', '2026-02-23 04:01:14.104611+00'),
  ('697eaa17-3f8f-4776-8a39-4f3767d124fc', '1273716c-f379-406d-8762-5a06ab73670f', 'KCG', 'CCC', true, true, '2026-02-23 04:01:15.312343+00', '2026-02-23 04:01:15.509509+00'),
  ('b515eb44-4fac-4022-bed5-a19cae0e1091', '0002b162-a7d1-41dc-a228-c03d79d7cf10', 'HTR', 'CCC', true, true, '2026-02-23 04:01:15.781147+00', '2026-02-23 04:01:15.976702+00'),
  ('091f06a1-9124-4034-a224-13b973491802', '623d34fd-f679-4563-ae58-1596b1455275', 'YCS', 'CCC', true, true, '2026-02-23 04:01:16.254133+00', '2026-02-23 04:01:16.452789+00'),
  ('e937d2b9-4583-4760-9311-c7d723169998', '46484ae8-d319-4c48-a364-2f0f8c359db4', 'MDS', 'CCC', true, false, '2026-02-23 04:01:16.72292+00', '2026-02-23 12:59:22.382766+00'),
  ('abd3e53e-1e2e-4fc7-8032-34570e935d11', '863bf1c0-d7bd-47c8-82f4-fa570bae9201', 'PMG', 'CCC', true, true, '2026-02-23 04:01:17.198515+00', '2026-02-23 04:01:17.398317+00'),
  ('44a23351-0d65-4124-86fe-da411c527f44', 'fa845c3a-dacd-4ca9-a9f8-419ce5c8bcb5', 'NSJ', 'DDD', true, true, '2026-02-23 04:01:23.134779+00', '2026-02-23 04:01:23.422512+00'),
  ('cd4d056d-373f-42d0-995a-efdc46a1ab69', 'ffdfc32d-d15c-42a0-947f-9644165236b1', 'RGB', 'DDD', true, true, '2026-02-23 04:01:23.716319+00', '2026-02-23 04:01:23.91707+00'),
  ('1ecf43f8-117e-42cf-be0d-4e278a4ddaa9', 'a9455269-b162-4ec9-98dc-3d0457e23244', 'JSH', 'DDD', true, false, '2026-02-23 04:01:21.785941+00', '2026-02-23 04:57:51.376537+00'),
  ('c0222829-8e29-4c29-bd0e-76219a95a3da', '20308320-f876-4539-ad41-115cb48bad7f', 'STI', 'DDD', true, false, '2026-02-23 04:01:22.629065+00', '2026-02-23 13:01:27.571397+00'),
  ('ffb1282c-f2bc-4b20-a5c2-343a9eece0be', '4c12739f-5442-4a6e-be83-083b6cd2f991', 'KGJ', 'EEE', true, true, '2026-02-23 04:01:24.194362+00', '2026-02-23 04:01:24.395107+00'),
  ('49599f81-18b7-49a2-a1f2-4234e6c9db17', 'd676869e-fb31-4001-857c-f94f55563c6b', 'JGS', 'EEE', true, true, '2026-02-23 04:01:24.687343+00', '2026-02-23 04:01:24.897072+00'),
  ('e4ad5f67-00cd-4041-96c9-437d96599f23', 'ffcf25a7-cd96-4b8f-8212-611d72eafc3d', 'KSM', 'EEE', true, true, '2026-02-23 04:01:25.174291+00', '2026-02-23 04:01:25.372794+00'),
  ('8d7ae6ac-b248-4ab3-8831-f6e4483d64c8', '7f740083-bee6-4cea-81c8-bcbcc0b4e73f', 'ACN', NULL, true, false, '2026-02-23 04:07:12.474559+00', '2026-02-23 11:21:25.257937+00');

-- user_roles
INSERT INTO user_roles (id, user_id, role) VALUES
  ('fe8bbe38-0c2d-4b1a-8137-9bc2ed86df21', '0894a56d-8891-446c-95d0-909736e6a22b', 'admin'),
  ('f2089c78-74d3-416f-9a58-d2a4727bc751', '7f740083-bee6-4cea-81c8-bcbcc0b4e73f', 'admin'),
  ('15493c76-5eac-4e13-854e-afb61909e061', '7c2e2b7b-479b-4822-8a3a-350ef5b89834', 'team_user'),
  ('a4eef20d-9e99-4d8b-9c4d-1655eee649f8', '56d73d23-b9dc-47f7-9283-87d225f3389c', 'team_user'),
  ('0d9188d4-d88b-414f-b8a7-da0422d1e722', '1569a0c7-a188-4993-a8f9-5de7a50c0370', 'team_user'),
  ('a01d08e9-5c91-4313-8937-0ccaa4f68d5d', '7e36ffa9-449c-4140-a35a-f38cafdaf291', 'team_user'),
  ('cfb82e15-2fb0-4131-8be2-28885ca0e991', '0e0f9cbe-1237-4c69-a2ca-c5451602cf71', 'team_user'),
  ('44077f63-a67f-4618-ab20-55dd3428f978', '6f5719da-a4cb-40be-b516-ea02c104786f', 'team_user'),
  ('5fdfaea3-4cfb-4c3e-af6c-0f0f2681bebd', '9e2ba006-0cf5-40d7-8024-29b3d91c5a43', 'team_user'),
  ('5e5431f5-c9f5-496d-9ae4-6d450e127a9e', '1273716c-f379-406d-8762-5a06ab73670f', 'team_user'),
  ('b2d97d08-14b1-4502-80fb-ee2c8bdca754', '0002b162-a7d1-41dc-a228-c03d79d7cf10', 'team_user'),
  ('4ebd7442-5278-4396-9871-4dc61739d83b', '623d34fd-f679-4563-ae58-1596b1455275', 'team_user'),
  ('5236bb1f-9dfa-4879-8b27-ec5e31143bf6', '863bf1c0-d7bd-47c8-82f4-fa570bae9201', 'team_user'),
  ('85ae4e1c-10eb-4167-9a4c-cff19afc866f', 'a0c3e69a-f038-4156-907e-4aeb794ec733', 'team_user'),
  ('ff72210c-e4db-4f8f-b851-2d6b13adb7f1', 'fa845c3a-dacd-4ca9-a9f8-419ce5c8bcb5', 'team_user'),
  ('890df66b-765e-4538-a9dc-b65a18e152b5', 'ffdfc32d-d15c-42a0-947f-9644165236b1', 'team_user'),
  ('bff2378e-fc61-4a57-b4ac-de31ef7b6825', '4c12739f-5442-4a6e-be83-083b6cd2f991', 'team_user'),
  ('72816709-5402-455e-82dd-800dab24db9e', 'd676869e-fb31-4001-857c-f94f55563c6b', 'team_user'),
  ('458ff4bb-7469-475a-b3ec-621b172768d3', 'ffcf25a7-cd96-4b8f-8212-611d72eafc3d', 'team_user'),
  ('d134eccd-9dba-4833-8cf1-fe12767de7e1', '4855a354-b9d1-4209-823e-6f6a1b193713', 'team_user'),
  ('62f79619-1242-4a2b-8b02-07f813636edf', '20308320-f876-4539-ad41-115cb48bad7f', 'team_user'),
  ('23f0da30-9b24-4a03-bcd0-86928cbb07a3', 'a9455269-b162-4ec9-98dc-3d0457e23244', 'team_user'),
  ('9602d6c1-2ce7-4bd2-8de1-ede08a9ecf62', '46484ae8-d319-4c48-a364-2f0f8c359db4', 'team_user');

-- user_preferences
INSERT INTO user_preferences (id, user_id, theme, compact_mode, default_landing_page, default_month, dashboard_layout, currency_format, table_density, accent_color, created_at, updated_at) VALUES
  ('6021bf18-0e5d-4cd7-a53f-6fcaecd221b4', '0894a56d-8891-446c-95d0-909736e6a22b', 'system', false, '/overview', NULL, 'default', 'EUR', 'normal', 'purple', '2026-02-23 04:20:36.501612+00', '2026-02-23 04:21:46.505634+00');

-- Empty tables (no data): months, transactions, monthly_summaries,
-- person_monthly_summaries, person_salary_balances, salary_settings,
-- wallet_starting_balances, notifications, activity_logs, custom_categories

-- ============================================================
-- NOTES:
-- 1. profiles.user_id and user_roles.user_id reference auth.users
--    in Supabase. For local Postgres, either:
--    a) Create a simple auth.users table, or
--    b) Remove the FK constraints from the DDL above
-- 2. RLS policies are Supabase-specific and not included here.
--    Implement access control at the application layer locally.
-- 3. The handle_new_user() trigger attaches to auth.users in
--    Supabase. Adapt for your local auth setup.
-- ============================================================
