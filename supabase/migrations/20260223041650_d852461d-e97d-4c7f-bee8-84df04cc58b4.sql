
-- Replace the overly permissive insert policy on notifications
DROP POLICY "System can insert notifications" ON public.notifications;

-- Allow authenticated users to insert their own notifications (for system-generated ones, edge functions use service_role)
CREATE POLICY "Users can insert own notifications"
ON public.notifications FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Replace overly permissive insert policy on activity_logs  
DROP POLICY "Anyone can insert activity logs" ON public.activity_logs;

CREATE POLICY "Users can insert own activity logs"
ON public.activity_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can insert any activity logs"
ON public.activity_logs FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
