
CREATE OR REPLACE FUNCTION public.is_teacher_of_class(_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.classes WHERE id = _class_id AND teacher_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_student_of_class(_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.students WHERE class_id = _class_id AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_of_student(_student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.students s JOIN public.classes c ON c.id=s.class_id WHERE s.id=_student_id AND c.teacher_id=auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_owner_of_student(_student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.students WHERE id=_student_id AND user_id=auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.student_teacher_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.teacher_id FROM public.students s JOIN public.classes c ON c.id=s.class_id WHERE s.user_id=auth.uid();
$$;

DROP POLICY IF EXISTS "student reads own class" ON public.classes;
DROP POLICY IF EXISTS "teacher manages own class students" ON public.students;
DROP POLICY IF EXISTS "student reads own attendance" ON public.attendance;
DROP POLICY IF EXISTS "teacher manages attendance for own students" ON public.attendance;
DROP POLICY IF EXISTS "student reads teacher holidays" ON public.holidays;

CREATE POLICY "student reads own class" ON public.classes FOR SELECT USING (public.is_student_of_class(id));
CREATE POLICY "teacher manages own class students" ON public.students FOR ALL USING (public.is_teacher_of_class(class_id)) WITH CHECK (public.is_teacher_of_class(class_id));
CREATE POLICY "student reads own attendance" ON public.attendance FOR SELECT USING (public.is_owner_of_student(student_id));
CREATE POLICY "teacher manages attendance for own students" ON public.attendance FOR ALL USING (public.is_teacher_of_student(student_id)) WITH CHECK (public.is_teacher_of_student(student_id));
CREATE POLICY "student reads teacher holidays" ON public.holidays FOR SELECT USING (teacher_id IN (SELECT public.student_teacher_ids()));

-- Seed class + students for RACE faculty
DO $$
DECLARE
  v_teacher uuid := '4ab7ebf7-000c-47f9-8f50-fa669ed0e4c8';
  v_class uuid;
BEGIN
  SELECT id INTO v_class FROM public.classes WHERE teacher_id=v_teacher AND name='Full time Batch 04 AY2025-27' LIMIT 1;
  IF v_class IS NULL THEN
    INSERT INTO public.classes(name, teacher_id, subject, section) VALUES ('Full time Batch 04 AY2025-27', v_teacher, 'PG Program', 'FT-04') RETURNING id INTO v_class;
  END IF;

  INSERT INTO public.students(class_id, name, email, quota, stream)
  VALUES
    (v_class,'Sai krishna k m','saikrish172003@gmail.com','PGCET','MTech CS'),
    (v_class,'Shashwath K S','shashwathkukunoor@gmail.com','PGCET','MTech AI'),
    (v_class,'Sewana M','sewanamudigal@gmail.com','PGCET','MTech CS'),
    (v_class,'Ambika Yallal','ambika.ry2000@gmail.com','PGCET','MTech AI'),
    (v_class,'Aishwarya L Pujeri','aishwaryapujeri23@gmail.com','PGCET','MTech AI'),
    (v_class,'Alina Shibu','alinamercy@gmail.com','PGCET','MTech AI'),
    (v_class,'Bhagyashree C Patil','bhagyashreepatil0903@gmail.com','PGCET','MTech AI'),
    (v_class,'Chalukya Nayaka B K','chalukyanayakabk2@gmail.com','PGCET','MTech CS'),
    (v_class,'Shilpa J','shilpaj18204@gmail.com','PGCET','MTech AI'),
    (v_class,'Janhvi Jeevan Revankar','revankarjanhvi@gmail.com','PGCET','MTech CS'),
    (v_class,'Kondamadugula Venkateshwara Reddy','kvenkatreddy1414@gmail.com','PGCET','MTech CS'),
    (v_class,'Sreediya S','sreediyasanjith26@gmail.com','PGCET','MTech CS'),
    (v_class,'Nithya T M','nithyatm045@gmail.com','PGCET','MTech CS'),
    (v_class,'Lakshmi Shivani K','lakshmishivanik.19@gmail.com','PGCET','MTech CS'),
    (v_class,'Jothika B','jothikachandra2027@gmail.com','PGCET','MTech AI'),
    (v_class,'Sneha S','nalini2952002@gmail.com','PGCET','MTech AI'),
    (v_class,'B Meenu','meenub255@gmail.com','MQ','MTech AI'),
    (v_class,'Kaarthikeyen G','g.kaarthik12@gmail.com','MQ','MSc CS'),
    (v_class,'Shaan Abraham','shaanabraham04@gmail.com','MQ','MSc CS'),
    (v_class,'Mevada Vinit','vinitmevada0253v@gmail.com','MQ','MTech CS'),
    (v_class,'Dhanusha G','dhanusha.govind99@gmail.com','PGCET','MTech AI'),
    (v_class,'Dattaguru Chettiar','gurudatta229028@gmail.com','MQ','MSc CS'),
    (v_class,'Avish T S','avishts18@gmail.com','PGCET','MTech AI'),
    (v_class,'Veda Shivayogi Ramagondanahalli','vedaram2002@gmail.com','PGCET','MTech AI'),
    (v_class,'Rajendra Rathod','rajprathod06@gmail.com','PGCET','MTech CS'),
    (v_class,'Ayesha','pgcet2501117@reva.edu.in','PGCET','MTech CS')
  ON CONFLICT DO NOTHING;
END $$;
