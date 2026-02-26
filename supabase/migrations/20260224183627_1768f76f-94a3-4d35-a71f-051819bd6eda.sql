
-- Create a teams table to allow empty teams to exist
CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Admins can manage teams" ON public.teams FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed existing teams from team_persons + known static teams
INSERT INTO public.teams (name)
SELECT DISTINCT team FROM public.team_persons
UNION
SELECT unnest(ARRAY['AAA','BBB','CCC','DDD','EEE','CSB'])
ON CONFLICT (name) DO NOTHING;
