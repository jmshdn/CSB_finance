
CREATE TABLE public.custom_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Income', 'Expense')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(name, type)
);

ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view custom categories"
  ON public.custom_categories FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert custom categories"
  ON public.custom_categories FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete custom categories"
  ON public.custom_categories FOR DELETE
  USING (auth.uid() IS NOT NULL);
