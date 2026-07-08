import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Mail, GraduationCap, TrendingUp, CalendarCheck } from "lucide-react";
import { monthDays, MONTH_NAMES } from "@/lib/attendance";

export const Route = createFileRoute("/_authenticated/teacher/student/$studentId")({
  component: StudentProfile,
});

type Row = {
  id: string; name: string; email: string; gender: string; quota: string; stream: string;
  user_id: string | null; class_id: string;
  classes: { id: string; name: string; section: string | null; subject: string | null; teacher_id: string } | null;
};

function StudentProfile() {
  const { studentId } = Route.useParams();
  const [student, setStudent] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [dates, setDates] = useState<{ date: string; type: "W" | "H" }[]>([]);
  const [statusByDate, setStatusByDate] = useState<Record<string, number>>({});
  const [overall, setOverall] = useState({ marked: 0, present: 0, absent: 0, half: 0, percent: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("students")
      .select("id,name,email,gender,quota,stream,user_id,class_id,classes(id,name,section,subject,teacher_id)")
      .eq("id", studentId).maybeSingle();
    setStudent((data as unknown as Row) ?? null);
    setLoading(false);
  }, [studentId]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!student) return;
    (async () => {
      const { data: hs } = await supabase
        .from("holidays").select("holiday_date")
        .eq("teacher_id", student.classes!.teacher_id);
      const holidays = new Set((hs ?? []).map((h: { holiday_date: string }) => h.holiday_date));
      const ds = monthDays(year, month, holidays);
      setDates(ds);

      const { data: att } = await supabase.from("attendance")
        .select("date,status").eq("student_id", student.id);
      const all = (att ?? []) as { date: string; status: number }[];

      const map: Record<string, number> = {};
      const first = ds[0]?.date ?? "";
      const last = ds[ds.length-1]?.date ?? "";
      all.forEach(r => { if (r.date >= first && r.date <= last) map[r.date] = Number(r.status); });
      setStatusByDate(map);

      let p = 0, a = 0, h = 0, sum = 0;
      all.forEach(r => {
        const v = Number(r.status);
        sum += v;
        if (v === 1) p += 1; else if (v === 0) a += 1; else h += 1;
      });
      const marked = all.length;
      setOverall({ marked, present: p, absent: a, half: h, percent: marked ? Math.round((sum/marked)*1000)/10 : 0 });
    })();
  }, [year, month, student]);

  const cells = useMemo(() => {
    if (!student) return [];
    const firstDow = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const out: (null | { date: string; day: number })[] = [];
    for (let i = 0; i < firstDow; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ date: `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`, day: d });
    }
    return out;
  }, [year, month, student]);
  const dateType = new Map(dates.map(d => [d.date, d.type] as const));

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (!student) return <p className="text-muted-foreground">Student not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link to="/teacher/class/$classId" params={{ classId: student.class_id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to class
        </Link>
        <Link to="/teacher"><Button variant="ghost" size="sm">Dashboard</Button></Link>
      </div>

      <div className="rounded-2xl p-6 text-white" style={{ background: "var(--gradient-primary)" }}>
        <p className="text-white/70 text-sm">Student profile</p>
        <h1 className="text-3xl font-bold">{student.name}</h1>
        <p className="text-white/80 mt-1">
          {student.classes?.name}
          {student.classes?.section ? ` · ${student.classes.section}` : ""}
          {student.classes?.subject ? ` · ${student.classes.subject}` : ""}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <InfoCard icon={<Mail className="h-4 w-4" />} label="Email" value={student.email} />
        <InfoCard icon={<GraduationCap className="h-4 w-4" />} label="Stream" value={student.stream} />
        <InfoCard icon={<GraduationCap className="h-4 w-4" />} label="Quota" value={student.quota} />
        <InfoCard icon={<CalendarCheck className="h-4 w-4" />} label="Login" value={student.user_id ? "Linked" : "Pending signup"} tone={student.user_id ? "good" : "warn"} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Attendance" value={`${overall.percent}%`} tone={overall.percent >= 90 ? "good" : overall.percent >= 75 ? "warn" : "bad"} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Days marked" value={overall.marked} />
        <StatCard label="Present" value={overall.present} />
        <StatCard label="Absent" value={overall.absent} hint={overall.half ? `${overall.half} half-day` : undefined} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle>Calendar — {MONTH_NAMES[month-1]} {year}</CardTitle>
            <CardDescription>Green = present, red = absent, yellow = half-day, grey = holiday.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTH_NAMES.map((n, i) => <SelectItem key={i} value={String(i+1)}>{n}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-xs text-center text-muted-foreground mb-2">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((c, i) => {
              if (!c) return <div key={i} />;
              const type = dateType.get(c.date);
              const status = statusByDate[c.date];
              let cls = "bg-muted/20 text-muted-foreground/50";
              let label = "";
              if (type === "H") {
                cls = "bg-muted text-muted-foreground";
                label = new Date(c.date).getDay() === 0 ? "Sun" : "H";
              } else if (type === "W") {
                if (status === 1) { cls = "bg-accent/20 text-accent"; label = "P"; }
                else if (status === 0) { cls = "bg-destructive/20 text-destructive"; label = "A"; }
                else if (status === 0.5) { cls = "bg-yellow-400/20 text-yellow-800"; label = "½"; }
                else { cls = "bg-muted/30 text-muted-foreground"; label = "—"; }
              }
              return (
                <div key={i} className={`aspect-square rounded-md flex flex-col items-center justify-center ${cls}`}>
                  <span className="text-sm font-semibold">{c.day}</span>
                  <span className="text-[10px]">{label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "good" | "warn" }) {
  const t = tone === "good" ? "text-accent" : tone === "warn" ? "text-yellow-700" : "text-foreground";
  return (
    <Card><CardContent className="p-5">
      <div className="flex items-center justify-between text-muted-foreground text-sm"><span>{label}</span>{icon}</div>
      <p className={`mt-1 text-lg font-semibold break-all ${t}`}>{value}</p>
    </CardContent></Card>
  );
}

function StatCard({ label, value, tone, icon, hint }: { label: string; value: string | number; tone?: "good" | "warn" | "bad"; icon?: React.ReactNode; hint?: string }) {
  const toneCls = tone === "good" ? "text-accent" : tone === "warn" ? "text-yellow-700" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <Card><CardContent className="p-5">
      <div className="flex items-center justify-between text-muted-foreground text-sm"><span>{label}</span>{icon}</div>
      <p className={`mt-1 text-3xl font-bold ${toneCls}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </CardContent></Card>
  );
}