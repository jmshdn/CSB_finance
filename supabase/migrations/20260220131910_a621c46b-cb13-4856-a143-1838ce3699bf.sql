
-- 1. App role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'team_user');

-- 2. Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  assigned_wallet TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Team persons (needed before transactions policies)
CREATE TABLE public.team_persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team TEXT NOT NULL,
  person_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team, person_name)
);
ALTER TABLE public.team_persons ENABLE ROW LEVEL SECURITY;

-- 5. Transactions
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL UNIQUE,
  date DATE NOT NULL,
  team TEXT NOT NULL,
  income_expense TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT,
  person TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12,2) NOT NULL,
  linked_wallet TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 6. Monthly summaries
CREATE TABLE public.monthly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT NOT NULL UNIQUE,
  income NUMERIC(12,2) NOT NULL DEFAULT 0,
  expense NUMERIC(12,2) NOT NULL DEFAULT 0,
  base_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  crypto_start NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.monthly_summaries ENABLE ROW LEVEL SECURITY;

-- 7. Person summaries
CREATE TABLE public.person_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  income NUMERIC(12,2) NOT NULL DEFAULT 0,
  expense NUMERIC(12,2) NOT NULL DEFAULT 0,
  revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.person_summaries ENABLE ROW LEVEL SECURITY;

-- 8. Security definer functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_wallet(_user_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT assigned_wallet FROM public.profiles WHERE user_id = _user_id
$$;

-- 9. RLS Policies

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Team persons
CREATE POLICY "Anyone authenticated can view team persons" ON public.team_persons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage team persons" ON public.team_persons FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Transactions
CREATE POLICY "Admins can do everything with transactions" ON public.transactions FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Team users can view own wallet transactions" ON public.transactions FOR SELECT USING (team = public.get_user_wallet(auth.uid()));
CREATE POLICY "Team users can view CSB transactions for their members" ON public.transactions FOR SELECT USING (
  team = 'CSB' AND EXISTS (
    SELECT 1 FROM public.team_persons tp WHERE tp.team = public.get_user_wallet(auth.uid()) AND tp.person_name = transactions.person
  )
);
CREATE POLICY "Team users can insert to own wallet" ON public.transactions FOR INSERT WITH CHECK (team = public.get_user_wallet(auth.uid()));
CREATE POLICY "Team users can update own wallet" ON public.transactions FOR UPDATE USING (team = public.get_user_wallet(auth.uid()));
CREATE POLICY "Team users can delete own wallet" ON public.transactions FOR DELETE USING (team = public.get_user_wallet(auth.uid()));

-- Monthly summaries
CREATE POLICY "Anyone authenticated can view monthly summaries" ON public.monthly_summaries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage monthly summaries" ON public.monthly_summaries FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Person summaries
CREATE POLICY "Anyone authenticated can view person summaries" ON public.person_summaries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage person summaries" ON public.person_summaries FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 10. Triggers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
