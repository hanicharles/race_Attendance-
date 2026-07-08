CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  leave_date date NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  teacher_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student reads own leave requests" ON public.leave_requests
  FOR SELECT USING (public.is_owner_of_student(student_id));

CREATE POLICY "student creates own leave requests" ON public.leave_requests
  FOR INSERT WITH CHECK (public.is_owner_of_student(student_id));

CREATE POLICY "student deletes own pending requests" ON public.leave_requests
  FOR DELETE USING (public.is_owner_of_student(student_id) AND status = 'pending');

CREATE POLICY "teacher reads leave requests of own students" ON public.leave_requests
  FOR SELECT USING (public.is_teacher_of_student(student_id));

CREATE POLICY "teacher updates leave requests of own students" ON public.leave_requests
  FOR UPDATE USING (public.is_teacher_of_student(student_id)) WITH CHECK (public.is_teacher_of_student(student_id));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_leave_requests_updated_at
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX leave_requests_student_date_unique ON public.leave_requests(student_id, leave_date);