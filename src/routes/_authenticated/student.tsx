import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { monthDays, rangeDays, MONTH_NAMES } from "@/lib/attendance";
import { GraduationCap, TrendingUp, AlertTriangle, Plus, Trash2, Mail, Calendar as CalendarIcon, Calculator, Clock, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/student")({
  component: StudentDashboard,
});

type StudentRow = {
  id: string; name: string; email: string; stream: string; quota: string;
  class_id: string;
  classes: { id: string; name: string; section: string | null; subject: string | null; teacher_id: string } | null;
};

function StudentDashboard() {
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user!.id;
    const email = userData.user!.email!;

    // Try to find own linked record
    let { data: s } = await supabase
      .from("students")
      .select("id,name,email,stream,quota,class_id,classes(id,name,section,subject,teacher_id)")
      .eq("user_id", uid)
      .maybeSingle();

    // Fallback: try to self-link (in case trigger didn't run due to casing)
    if (!s) {
      const { data: pending } = await supabase
        .from("students")
        .select("id")
        .ilike("email", email)
        .is("user_id", null)
        .maybeSingle();
      if (pending) {
        const { error: linkErr } = await supabase.from("students").update({ user_id: uid }).eq("id", pending.id);
        if (!linkErr) {
          const { data: refetched } = await supabase
            .from("students")
            .select("id,name,email,stream,quota,class_id,classes(id,name,section,subject,teacher_id)")
            .eq("id", pending.id)
            .maybeSingle();
          s = refetched;
        }
      }
    }

    if (!s) setNotFound(true);
    else setStudent(s as unknown as StudentRow);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Student" />
      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : notFound ? (
          <NoStudentRecord />
        ) : student ? (
          <StudentBody student={student} />
        ) : null}
      </main>
    </div>
  );
}

function NoStudentRecord() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5" /> No class yet</CardTitle>
        <CardDescription>
          Your teacher hasn't added you to a class with this email address.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Ask your teacher to add your email to their class roster. Once they do, sign out and sign in again — your dashboard will appear automatically.
      </CardContent>
    </Card>
  );
}

function StudentBody({ student }: { student: StudentRow }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [dates, setDates] = useState<{ date: string; type: "W" | "H" }[]>([]);
  const [statusByDate, setStatusByDate] = useState<Record<string, number>>({});
  const [reasonByDate, setReasonByDate] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data: hs, error: hErr } = await supabase
        .from("holidays").select("holiday_date,reason")
        .eq("teacher_id", student.classes!.teacher_id);
      if (hErr) toast.error(hErr.message);
      const holidays = new Set<string>();
      const reasons: Record<string, string> = {};
      (hs ?? []).forEach((h: { holiday_date: string; reason: string | null }) => {
        holidays.add(h.holiday_date);
        if (h.reason) reasons[h.holiday_date] = h.reason;
      });
      const ds = monthDays(year, month, holidays);
      setDates(ds);
      setReasonByDate(reasons);

      const { data: att } = await supabase
        .from("attendance").select("date,status")
        .eq("student_id", student.id)
        .gte("date", ds[0]?.date ?? "1970-01-01")
        .lte("date", ds[ds.length-1]?.date ?? "1970-01-01");
      const map: Record<string, number> = {};
      (att ?? []).forEach((r: { date: string; status: number }) => { map[r.date] = Number(r.status); });
      setStatusByDate(map);
    })();
  }, [year, month, student]);

  const stats = useMemo(() => {
    let total = 0, present = 0;
    dates.forEach(d => {
      if (d.type === "H") return;
      const status = statusByDate[d.date];
      if (status === undefined) return; // Skip unmarked days
      total += 1;
      present += status;
    });
    const percent = total ? Math.round((present/total)*1000)/10 : 0;
    return { total, present, absent: total - present, percent };
  }, [dates, statusByDate]);

  // Build calendar grid (Sun-first)
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (null | { date: string; day: number })[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    cells.push({ date: iso, day: d });
  }
  const dateType = new Map(dates.map(d => [d.date, d.type] as const));

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 text-white" style={{ background: "var(--gradient-primary)" }}>
        <p className="text-white/70 text-sm">Signed in as</p>
        <h1 className="text-3xl font-bold">{student.name}</h1>
        <p className="text-white/80 mt-1">
          {student.classes?.name}
          {student.classes?.section ? ` · ${student.classes.section}` : ""}
          {student.classes?.subject ? ` · ${student.classes.subject}` : ""}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Attendance" value={`${stats.percent}%`} tone={stats.percent >= 90 ? "good" : stats.percent >= 75 ? "warn" : "bad"} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Working days" value={stats.total} />
        <StatCard label="Present" value={stats.present} />
        <StatCard label="Absent" value={stats.absent} />
      </div>

      {stats.total > 0 && stats.percent < 90 && (
        <div className={`rounded-xl border p-4 flex items-start gap-3 ${stats.percent < 75 ? "bg-destructive/10 border-destructive/30 text-destructive" : "bg-yellow-500/10 border-yellow-500/30 text-yellow-800"}`}>
          <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">
              {stats.percent < 75 ? "Critical: attendance below 75%" : "Attendance below the 90% criteria"}
            </p>
            <p className="opacity-90">
              You need {Math.max(0, Math.ceil(0.9 * stats.total - stats.present))} more present day{Math.max(0, Math.ceil(0.9 * stats.total - stats.present)) === 1 ? "" : "s"} to reach 90%. Please meet your faculty if you have concerns.
            </p>
          </div>
        </div>
      )}

      <StudentCustomCalculator
        student={student}
        year={year}
        setYear={setYear}
        month={month}
        setMonth={setMonth}
        cells={cells}
        dateType={dateType}
        statusByDate={statusByDate}
        reasonByDate={reasonByDate}
      />

      <LeaveRequestsSection studentId={student.id} />
    </div>
  );
}

function StudentCustomCalculator({
  student,
  year,
  setYear,
  month,
  setMonth,
  cells,
  dateType,
  statusByDate,
  reasonByDate,
}: {
  student: StudentRow;
  year: number;
  setYear: (y: number) => void;
  month: number;
  setMonth: (m: number) => void;
  cells: (null | { date: string; day: number })[];
  dateType: Map<string, "W" | "H">;
  statusByDate: Record<string, number>;
  reasonByDate: Record<string, string>;
}) {
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const thirtyDaysAgoIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, []);

  const [activePreset, setActivePreset] = useState<"thisMonth" | "30days" | "60days" | "90days" | "custom">("30days");
  const [startDate, setStartDate] = useState(thirtyDaysAgoIso);
  const [endDate, setEndDate] = useState(todayIso);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{
    total: number;
    present: number;
    absent: number;
    half: number;
    percent: number;
  } | null>(null);

  const calculate = useCallback(async () => {
    if (!startDate || !endDate) return;
    if (startDate > endDate) {
      toast.error("Start date cannot be after end date");
      return;
    }
    setLoading(true);
    const { data: hs } = await supabase
      .from("holidays")
      .select("holiday_date")
      .eq("teacher_id", student.classes!.teacher_id);
    const holidays = new Set<string>((hs ?? []).map((h: { holiday_date: string }) => h.holiday_date));

    const ds = rangeDays(startDate, endDate, holidays);

    const { data: att } = await supabase
      .from("attendance")
      .select("date,status")
      .eq("student_id", student.id)
      .gte("date", startDate)
      .lte("date", endDate);

    const attMap = new Map<string, number>();
    (att ?? []).forEach((r: { date: string; status: number }) => attMap.set(r.date, Number(r.status)));

    let total = 0,
      sum = 0,
      present = 0,
      absent = 0,
      half = 0;
    ds.forEach((d) => {
      if (d.type === "H") return;
      const st = attMap.get(d.date);
      if (st === undefined) return;
      total += 1;
      sum += st;
      if (st === 1) present += 1;
      else if (st === 0) absent += 1;
      else half += 1;
    });

    const percent = total ? Math.round((sum / total) * 1000) / 10 : 0;
    setStats({ total, present, absent, half, percent });
    setLoading(false);
  }, [startDate, endDate, student]);

  useEffect(() => {
    calculate();
  }, [calculate]);

  const applyPreset = (preset: "thisMonth" | "30days" | "60days" | "90days") => {
    setActivePreset(preset);
    const now = new Date();
    const end = now.toISOString().slice(0, 10);
    let start = end;
    if (preset === "thisMonth") {
      start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    } else if (preset === "30days") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      start = d.toISOString().slice(0, 10);
    } else if (preset === "60days") {
      const d = new Date();
      d.setDate(d.getDate() - 60);
      start = d.toISOString().slice(0, 10);
    } else if (preset === "90days") {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      start = d.toISOString().slice(0, 10);
    }
    setStartDate(start);
    setEndDate(end);
  };

  const handleDayClick = (iso: string) => {
    if (iso > todayIso) return;
    setActivePreset("custom");
    if (!startDate || (startDate && endDate && startDate !== endDate)) {
      setStartDate(iso);
      setEndDate(iso);
    } else if (startDate && (!endDate || startDate === endDate)) {
      if (iso < startDate) {
        setStartDate(iso);
        setEndDate(startDate);
      } else {
        setEndDate(iso);
      }
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border border-gray-200/80 bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
              <Calculator className="h-5 w-5 text-primary" /> Calendar Date Range Calculator
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Calculate {student.name}&apos;s attendance percentage for custom start and end dates.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Quick Presets:
            </span>
            <button
              type="button"
              onClick={() => applyPreset("thisMonth")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                activePreset === "thisMonth"
                  ? "bg-[#38a169] text-white shadow-xs font-semibold"
                  : "bg-muted/40 hover:bg-muted text-foreground border border-gray-200"
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => applyPreset("30days")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                activePreset === "30days"
                  ? "bg-[#38a169] text-white shadow-xs font-semibold"
                  : "bg-muted/40 hover:bg-muted text-foreground border border-gray-200"
              }`}
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => applyPreset("60days")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                activePreset === "60days"
                  ? "bg-[#38a169] text-white shadow-xs font-semibold"
                  : "bg-muted/40 hover:bg-muted text-foreground border border-gray-200"
              }`}
            >
              Last 60 Days
            </button>
            <button
              type="button"
              onClick={() => applyPreset("90days")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                activePreset === "90days"
                  ? "bg-[#38a169] text-white shadow-xs font-semibold"
                  : "bg-muted/40 hover:bg-muted text-foreground border border-gray-200"
              }`}
            >
              Last 90 Days
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-end">
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Start Date</Label>
            <Input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => {
                setActivePreset("custom");
                setStartDate(e.target.value);
              }}
              className="h-11 rounded-xl border-gray-200 bg-background text-sm font-medium"
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">End Date</Label>
            <Input
              type="date"
              value={endDate}
              min={startDate}
              max={todayIso}
              onChange={(e) => {
                setActivePreset("custom");
                setEndDate(e.target.value);
              }}
              className="h-11 rounded-xl border-gray-200 bg-background text-sm font-medium"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <Button
              onClick={calculate}
              disabled={loading}
              className="h-11 w-full rounded-xl bg-[#1D3557] hover:bg-[#142640] text-white font-semibold text-sm transition-all shadow-xs"
            >
              {loading ? "Calculating…" : "Calculate Percentage"}
            </Button>
          </div>
        </div>

        <div className="my-5 border-t border-border/60" />

        {stats && (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-xl border border-gray-200/80 bg-background p-4 flex flex-col justify-between shadow-2xs">
              <span className="text-xs font-medium text-muted-foreground">Range Attendance %</span>
              <div className="mt-3 flex items-baseline justify-between">
                <span
                  className={`text-3xl font-extrabold ${
                    stats.percent >= 90
                      ? "text-[#22c55e]"
                      : stats.percent >= 75
                        ? "text-[#eab308]"
                        : "text-[#ef4444]"
                  }`}
                >
                  {stats.percent}%
                </span>
                <Sparkles className="h-4 w-4 text-primary opacity-60" />
              </div>
            </div>
            <div className="rounded-xl border border-gray-200/80 bg-background p-4 flex flex-col justify-between shadow-2xs">
              <span className="text-xs font-medium text-muted-foreground">Working Days</span>
              <p className="mt-3 text-3xl font-extrabold text-foreground">{stats.total}</p>
            </div>
            <div className="rounded-xl border border-gray-200/80 bg-background p-4 flex flex-col justify-between shadow-2xs">
              <span className="text-xs font-medium text-muted-foreground">Present Days</span>
              <p className="mt-3 text-3xl font-extrabold text-[#22c55e]">{stats.present}</p>
            </div>
            <div className="rounded-xl border border-gray-200/80 bg-background p-4 flex flex-col justify-between shadow-2xs">
              <span className="text-xs font-medium text-muted-foreground">Absent Days</span>
              <p className="mt-3 text-3xl font-extrabold text-[#ef4444]">{stats.absent}</p>
            </div>
            <div className="rounded-xl border border-gray-200/80 bg-background p-4 flex flex-col justify-between shadow-2xs">
              <span className="text-xs font-medium text-muted-foreground">Half Days</span>
              <p className="mt-3 text-3xl font-extrabold text-[#d97706]">{stats.half}</p>
            </div>
          </div>
        )}
      </Card>

      <Card className="rounded-2xl border border-gray-200/80 bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div>
            <h4 className="text-base font-bold tracking-tight flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              Interactive Attendance Calendar — {MONTH_NAMES[month - 1]} {year}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click any date on the calendar grid to select or adjust custom calculation range.
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-36 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((n, i) => (
                  <SelectItem key={i} value={String(i + 1)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-xs text-center text-muted-foreground mb-2 font-semibold">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((c, i) => {
            if (!c) return <div key={i} />;
            const type = dateType.get(c.date);
            const status = statusByDate[c.date];
            const inRange = startDate && endDate && c.date >= startDate && c.date <= endDate;

            let cls = "bg-muted/40 text-muted-foreground";
            let label = "";
            if (!type) {
              cls = "bg-muted/20 text-muted-foreground/50";
            } else if (type === "H") {
              cls = "bg-muted text-muted-foreground font-semibold";
              label = reasonByDate[c.date] ? "H" : new Date(c.date).getDay() === 0 ? "Sun" : "H";
            } else {
              if (status === undefined) {
                cls = "bg-muted/10 text-muted-foreground/30";
                label = "—";
              } else if (status === 1) {
                cls = "bg-emerald-500/20 text-emerald-700 font-bold";
                label = "P";
              } else if (status === 0) {
                cls = "bg-red-500/20 text-red-700 font-bold";
                label = "A";
              } else {
                cls = "bg-amber-400/20 text-amber-800 font-bold";
                label = "½";
              }
            }

            return (
              <button
                type="button"
                key={i}
                onClick={() => handleDayClick(c.date)}
                disabled={c.date > todayIso}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${cls} ${
                  inRange ? "ring-2 ring-primary ring-offset-1 z-10 shadow-xs" : ""
                }`}
                title={reasonByDate[c.date] ?? ""}
              >
                <span className="text-sm font-bold">{c.day}</span>
                <span className="text-[10px]">{label}</span>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

type LeaveRow = {
  id: string;
  leave_date: string;
  reason: string | null;
  status: string;
  created_at: string;
};

function LeaveRequestsSection({ studentId }: { studentId: string }) {
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ leave_date: "", reason: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("leave_requests")
      .select("id,leave_date,reason,status,created_at")
      .eq("student_id", studentId)
      .order("leave_date", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as LeaveRow[]) ?? []);
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!form.leave_date) return toast.error("Pick a date");
    setSaving(true);
    const { error } = await supabase.from("leave_requests").insert({
      student_id: studentId,
      leave_date: form.leave_date,
      reason: form.reason.trim() || null,
    });
    setSaving(false);
    if (error) {
      if (error.code === "23505") return toast.error("You already requested leave for that date");
      return toast.error(error.message);
    }
    toast.success("Leave request submitted");
    setOpen(false);
    setForm({ leave_date: "", reason: "" });
    load();
  };

  const cancel = async (id: string) => {
    const { error } = await supabase.from("leave_requests").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Request cancelled");
    load();
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Leave requests</CardTitle>
          <CardDescription>Request leave for a specific date. Your teacher will approve or reject it.</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Request leave</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Request leave</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Date *</Label>
                <Input type="date" min={today} value={form.leave_date} onChange={(e) => setForm({ ...form, leave_date: e.target.value })} />
              </div>
              <div>
                <Label>Reason</Label>
                <Textarea rows={3} placeholder="e.g. medical appointment" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </div>
            </div>
            <DialogFooter><Button onClick={submit} disabled={saving}>{saving ? "Submitting…" : "Submit"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No leave requests yet.</p>
        ) : (
          <div className="divide-y">
            {rows.map(r => {
              const cls =
                r.status === "approved" ? "bg-accent/20 text-accent" :
                r.status === "rejected" ? "bg-destructive/20 text-destructive" :
                "bg-yellow-500/20 text-yellow-800";
              return (
                <div key={r.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{new Date(r.leave_date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{r.status}</span>
                    </div>
                    {r.reason && <p className="text-sm text-muted-foreground mt-1">{r.reason}</p>}
                  </div>
                  {r.status === "pending" && (
                    <Button size="sm" variant="ghost" onClick={() => cancel(r.id)}><Trash2 className="h-4 w-4" /></Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, tone, icon }: { label: string; value: string | number; tone?: "good" | "warn" | "bad"; icon?: React.ReactNode }) {
  const toneCls = tone === "good" ? "text-accent" : tone === "warn" ? "text-yellow-700" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between text-muted-foreground text-sm">
          <span>{label}</span>{icon}
        </div>
        <p className={`mt-1 text-3xl font-bold ${toneCls}`}>{value}</p>
      </CardContent>
    </Card>
  );
}