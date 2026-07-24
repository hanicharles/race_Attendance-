import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  BookOpen,
  CalendarDays,
  Users,
  UserCheck,
  UserX,
  TrendingDown,
  AlertTriangle,
  Percent,
  Mail,
  Trash2,
  Calculator,
  Clock,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MONTH_NAMES } from "@/lib/attendance";

export const Route = createFileRoute("/_authenticated/teacher")({
  component: TeacherLayout,
});

type Klass = { id: string; name: string; section: string | null; subject: string | null };

function TeacherLayout() {
  const matchRoute = useMatchRoute();
  const atIndex = !!matchRoute({ to: "/teacher", fuzzy: false });
  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Teacher" />
      <main className="mx-auto max-w-6xl px-6 py-8">{atIndex ? <TeacherHome /> : <Outlet />}</main>
    </div>
  );
}

function TeacherHome() {
  const [classes, setClasses] = useState<Klass[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", section: "", subject: "" });

  const load = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user!.id;
    const { data, error } = await supabase
      .from("classes")
      .select("id,name,section,subject")
      .eq("teacher_id", uid)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setClasses((data as Klass[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!form.name.trim()) return toast.error("Class name required");
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("classes").insert({
      teacher_id: userData.user!.id,
      name: form.name.trim(),
      section: form.section.trim() || null,
      subject: form.subject.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Class created");
    setOpen(false);
    setForm({ name: "", section: "", subject: "" });
    load();
  };

  return (
    <div className="space-y-6">
      <FacultyDashboard />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Your classes</h1>
          <p className="text-muted-foreground text-sm">
            Create a class, then add students and take attendance.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/teacher/leaves">
            <Button variant="outline">
              <Mail className="h-4 w-4 mr-1" />
              Leave requests
            </Button>
          </Link>
          <Link to="/teacher/holidays">
            <Button variant="outline">
              <CalendarDays className="h-4 w-4 mr-1" />
              Holidays
            </Button>
          </Link>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" />
                New class
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create class</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Class name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="MSc CS 2026"
                  />
                </div>
                <div>
                  <Label>Section</Label>
                  <Input
                    value={form.section}
                    onChange={(e) => setForm({ ...form, section: e.target.value })}
                    placeholder="A"
                  />
                </div>
                <div>
                  <Label>Subject</Label>
                  <Input
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="Data Structures"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={create}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : classes.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No classes yet. Create your first class to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <Link key={c.id} to="/teacher/class/$classId" params={{ classId: c.id }}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div className="space-y-1">
                    <CardTitle>{c.name}</CardTitle>
                    <CardDescription>
                      {[c.section, c.subject].filter(Boolean).join(" · ") || "No section / subject"}
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (
                        confirm(
                          `Are you sure you want to delete the class "${c.name}"? This will delete all student rosters and attendance records in this class.`,
                        )
                      ) {
                        const { error } = await supabase.from("classes").delete().eq("id", c.id);
                        if (error) {
                          toast.error(error.message);
                        } else {
                          toast.success("Class deleted");
                          load();
                        }
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

type StudentStat = {
  id: string;
  name: string;
  email: string;
  className: string;
  totalDays: number;
  present: number;
  absent: number;
  half: number;
  percent: number;
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type RawRow = { student_id: string; date: string; status: number };
type Student = { id: string; name: string; email: string; class_id: string };

function FacultyDashboard() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [classMap, setClassMap] = useState<Map<string, string>>(new Map());
  const [rows, setRows] = useState<RawRow[]>([]);

  const now = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => todayISO(), []);
  const thirtyDaysAgoIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const [viewMode, setViewMode] = useState<"all" | "month" | "custom">("month");
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [startDate, setStartDate] = useState(thirtyDaysAgoIso);
  const [endDate, setEndDate] = useState(todayIso);

  const [classFilter, setClassFilter] = useState<string>("all");
  const [today, setToday] = useState({ present: 0, absent: 0, half: 0, marked: 0 });
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [holidayReasons, setHolidayReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;

      const { data: hs } = await supabase.from("holidays").select("holiday_date,reason").eq("teacher_id", uid);
      const hSet = new Set<string>();
      const hReas: Record<string, string> = {};
      (hs ?? []).forEach((h: { holiday_date: string; reason: string | null }) => {
        hSet.add(h.holiday_date);
        if (h.reason) hReas[h.holiday_date] = h.reason;
      });
      setHolidays(hSet);
      setHolidayReasons(hReas);

      const { data: cls } = await supabase.from("classes").select("id,name").eq("teacher_id", uid);
      const cm = new Map<string, string>(
        (cls ?? []).map((c: { id: string; name: string }) => [c.id, c.name] as const),
      );
      setClassMap(cm);
      const classIds = [...cm.keys()];
      if (classIds.length === 0) {
        setStudents([]);
        setRows([]);
        setLoading(false);
        return;
      }

      const { data: studs } = await supabase
        .from("students")
        .select("id,name,email,class_id")
        .in("class_id", classIds);
      const st = (studs ?? []) as Student[];
      setStudents(st);
      if (st.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const sIds = st.map((s) => s.id);
      const { data: att } = await supabase
        .from("attendance")
        .select("student_id,date,status")
        .in("student_id", sIds);
      const allRows = (att ?? []) as RawRow[];
      setRows(allRows);

      // Auto-default to the most recent month/year that has data
      if (allRows.length > 0) {
        let maxDate = allRows[0].date;
        allRows.forEach((r) => {
          if (r.date > maxDate) maxDate = r.date;
        });
        const [yr, mo] = maxDate.split("-").map(Number);
        setSelectedMonth(mo);
        setSelectedYear(yr);
      }

      // Today's stats (independent of range filter)
      const t = todayISO();
      let tp = 0,
        ta = 0,
        th = 0,
        tm = 0;
      allRows
        .filter((r) => r.date === t)
        .forEach((r) => {
          tm += 1;
          const v = Number(r.status);
          if (v === 1) tp += 1;
          else if (v === 0) ta += 1;
          else th += 1;
        });
      setToday({ present: tp, absent: ta, half: th, marked: tm });
      setLoading(false);
    })();
  }, []);

  const dailySummary = useMemo(() => {
    const map: Record<string, { present: number; total: number; percent: number }> = {};
    rows.forEach((r) => {
      if (!map[r.date]) map[r.date] = { present: 0, total: 0, percent: 0 };
      map[r.date].total += 1;
      map[r.date].present += Number(r.status);
    });
    Object.keys(map).forEach((d) => {
      const item = map[d];
      item.percent = item.total ? Math.round((item.present / item.total) * 100) : 0;
    });
    return map;
  }, [rows]);

  const stats = useMemo<StudentStat[]>(() => {
    if (students.length === 0) return [];
    const scoped =
      classFilter === "all" ? students : students.filter((s) => s.class_id === classFilter);
    const scopedIds = new Set(scoped.map((s) => s.id));

    const filtered = rows.filter((r) => {
      if (!scopedIds.has(r.student_id)) return false;
      if (viewMode === "month") {
        const [yr, mo] = r.date.split("-").map(Number);
        return yr === selectedYear && mo === selectedMonth;
      }
      if (viewMode === "custom") {
        return r.date >= startDate && r.date <= endDate;
      }
      return true;
    });

    const daySet = new Set(filtered.map((r) => r.date));
    const totalDays = daySet.size;

    const per = new Map<
      string,
      { present: number; absent: number; half: number; sum: number; days: number }
    >();
    scoped.forEach((s) => per.set(s.id, { present: 0, absent: 0, half: 0, sum: 0, days: 0 }));
    filtered.forEach((r) => {
      const b = per.get(r.student_id);
      if (!b) return;
      const v = Number(r.status);
      b.sum += v;
      b.days += 1;
      if (v === 1) b.present += 1;
      else if (v === 0) b.absent += 1;
      else b.half += 1;
    });

    return scoped
      .map((s) => {
        const b = per.get(s.id)!;
        const percent = b.days ? Math.round((b.sum / b.days) * 1000) / 10 : 0;
        return {
          id: s.id,
          name: s.name,
          email: s.email,
          className: classMap.get(s.class_id) ?? "",
          totalDays,
          present: b.present,
          absent: b.absent,
          half: b.half,
          percent,
        };
      })
      .sort((a, b) => a.percent - b.percent);
  }, [students, rows, viewMode, selectedMonth, selectedYear, startDate, endDate, classMap, classFilter]);

  const summary = useMemo(() => {
    const total = stats.length;
    const good = stats.filter((s) => s.percent >= 90).length;
    const warn = stats.filter((s) => s.percent >= 75 && s.percent < 90).length;
    const bad = stats.filter((s) => s.percent < 75).length;
    const avg = total
      ? Math.round((stats.reduce((a, s) => a + s.percent, 0) / total) * 10) / 10
      : 0;
    const markedDays = stats[0]?.totalDays ?? 0;
    return { total, good, warn, bad, avg, markedDays };
  }, [stats]);

  const applyPreset = (preset: "thisMonth" | "30days" | "60days" | "90days") => {
    const end = todayIso;
    let start = end;
    if (preset === "thisMonth") {
      start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    } else if (preset === "30days") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    } else if (preset === "60days") {
      const d = new Date();
      d.setDate(d.getDate() - 60);
      start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    } else if (preset === "90days") {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    setStartDate(start);
    setEndDate(end);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading dashboard…
        </CardContent>
      </Card>
    );
  }
  if (students.length === 0) return null;

  const atRisk = stats.filter((s) => s.percent < 90).slice(0, 10);

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            Dashboard
          </h2>
          <p className="text-muted-foreground text-sm">
            {viewMode === "all"
              ? "All time"
              : viewMode === "month"
                ? `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`
                : `Custom Range (${startDate} to ${endDate})`}{" "}
            · based on {summary.markedDays} marked day{summary.markedDays === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {[...classMap.entries()].map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as "all" | "month" | "custom")}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Monthly</SelectItem>
              <SelectItem value="custom">Custom Date Range</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          {viewMode === "month" && (
            <>
              <Select
                value={String(selectedMonth)}
                onValueChange={(v) => setSelectedMonth(Number(v))}
              >
                <SelectTrigger className="w-32">
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
              <Select
                value={String(selectedYear)}
                onValueChange={(v) => setSelectedYear(Number(v))}
              >
                <SelectTrigger className="w-24">
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
            </>
          )}
        </div>
      </div>

      {viewMode === "custom" && (
        <Card className="rounded-2xl border border-gray-200/80 bg-card p-6 shadow-sm">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
                <Calculator className="h-5 w-5 text-primary" /> Calendar Date Range Calculator
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Calculate class attendance percentage for custom start and end dates.
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
                  startDate === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
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
                  startDate === thirtyDaysAgoIso
                    ? "bg-[#38a169] text-white shadow-xs font-semibold"
                    : "bg-muted/40 hover:bg-muted text-foreground border border-gray-200"
                }`}
              >
                Last 30 Days
              </button>
              <button
                type="button"
                onClick={() => applyPreset("60days")}
                className="rounded-full px-4 py-1.5 text-xs font-medium bg-muted/40 hover:bg-muted text-foreground border border-gray-200 transition-all"
              >
                Last 60 Days
              </button>
              <button
                type="button"
                onClick={() => applyPreset("90days")}
                className="rounded-full px-4 py-1.5 text-xs font-medium bg-muted/40 hover:bg-muted text-foreground border border-gray-200 transition-all"
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
                onChange={(e) => setStartDate(e.target.value)}
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
                onChange={(e) => setEndDate(e.target.value)}
                className="h-11 rounded-xl border-gray-200 bg-background text-sm font-medium"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <Button
                className="h-11 w-full rounded-xl bg-[#1D3557] hover:bg-[#142640] text-white font-semibold text-sm transition-all shadow-xs"
              >
                Calculate Percentage
              </Button>
            </div>
          </div>

          <div className="my-5 border-t border-border/60" />

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-xl border border-gray-200/80 bg-background p-4 flex flex-col justify-between shadow-2xs">
              <span className="text-xs font-medium text-muted-foreground">Range Attendance %</span>
              <div className="mt-3 flex items-baseline justify-between">
                <span
                  className={`text-3xl font-extrabold ${
                    summary.avg >= 90
                      ? "text-[#22c55e]"
                      : summary.avg >= 75
                        ? "text-[#eab308]"
                        : "text-[#ef4444]"
                  }`}
                >
                  {summary.avg}%
                </span>
                <Percent className="h-4 w-4 text-primary opacity-60" />
              </div>
            </div>
            <div className="rounded-xl border border-gray-200/80 bg-background p-4 flex flex-col justify-between shadow-2xs">
              <span className="text-xs font-medium text-muted-foreground">Working Days</span>
              <p className="mt-3 text-3xl font-extrabold text-foreground">{summary.markedDays}</p>
            </div>
            <div className="rounded-xl border border-gray-200/80 bg-background p-4 flex flex-col justify-between shadow-2xs">
              <span className="text-xs font-medium text-muted-foreground">Total Students</span>
              <p className="mt-3 text-3xl font-extrabold text-[#22c55e]">{summary.total}</p>
            </div>
            <div className="rounded-xl border border-gray-200/80 bg-background p-4 flex flex-col justify-between shadow-2xs">
              <span className="text-xs font-medium text-muted-foreground">Below 75%</span>
              <p className="mt-3 text-3xl font-extrabold text-[#ef4444]">{summary.bad}</p>
            </div>
            <div className="rounded-xl border border-gray-200/80 bg-background p-4 flex flex-col justify-between shadow-2xs">
              <span className="text-xs font-medium text-muted-foreground">75% - 89%</span>
              <p className="mt-3 text-3xl font-extrabold text-[#d97706]">{summary.warn}</p>
            </div>
          </div>
        </Card>
      )}

      {summary.markedDays === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No attendance marked in this range yet.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatBox
              icon={<Users className="h-4 w-4" />}
              label="Total students"
              value={summary.total}
            />
            <StatBox
              icon={<Percent className="h-4 w-4" />}
              label="Average attendance"
              value={`${summary.avg}%`}
              tone={summary.avg >= 90 ? "good" : summary.avg >= 75 ? "warn" : "bad"}
            />
            <StatBox
              icon={<UserCheck className="h-4 w-4" />}
              label="Present today"
              value={today.present}
              hint={today.marked ? `${today.marked} marked` : "Not marked yet"}
              tone="good"
            />
            <StatBox
              icon={<UserX className="h-4 w-4" />}
              label="Absent today"
              value={today.absent}
              hint={today.half ? `${today.half} half-day` : undefined}
              tone={today.absent ? "bad" : undefined}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <CategoryCard
              tone="good"
              label="≥ 90% (safe)"
              count={summary.good}
              total={summary.total}
            />
            <CategoryCard
              tone="warn"
              label="75% – 89% (watch)"
              count={summary.warn}
              total={summary.total}
            />
            <CategoryCard
              tone="bad"
              label="Below 75% (critical)"
              count={summary.bad}
              total={summary.total}
            />
          </div>

          <FacultyCalendarCard
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            setViewMode={setViewMode}
            dailySummary={dailySummary}
            holidays={holidays}
            holidayReasons={holidayReasons}
            applyPreset={applyPreset}
            todayIso={todayIso}
          />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  Students below 90%
                </CardTitle>
                <CardDescription>
                  {atRisk.length === 0
                    ? "Everyone is above the 90% attendance criteria."
                    : `${atRisk.length} student${atRisk.length === 1 ? "" : "s"} need${atRisk.length === 1 ? "s" : ""} attention.`}
                </CardDescription>
              </div>
              <TrendingDown className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            {atRisk.length > 0 && (
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground border-y bg-muted/30">
                      <tr>
                        <th className="p-3">Student</th>
                        <th className="p-3">Class</th>
                        <th className="p-3 text-center">Present</th>
                        <th className="p-3 text-center">Absent</th>
                        <th className="p-3 text-center">½</th>
                        <th className="p-3 text-right">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {atRisk.map((s) => {
                        const tone = s.percent >= 75 ? "text-yellow-700" : "text-destructive";
                        return (
                          <tr key={s.id} className="border-b last:border-0">
                            <td className="p-3">
                              <Link
                                to="/teacher/student/$studentId"
                                params={{ studentId: s.id }}
                                className="font-medium hover:underline text-primary"
                              >
                                {s.name}
                              </Link>
                              <div className="text-xs text-muted-foreground">{s.email}</div>
                            </td>
                            <td className="p-3 text-muted-foreground">{s.className}</td>
                            <td className="p-3 text-center">{s.present}</td>
                            <td className="p-3 text-center">{s.absent}</td>
                            <td className="p-3 text-center">{s.half}</td>
                            <td className={`p-3 text-right font-semibold ${tone}`}>{s.percent}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            )}
          </Card>
        </>
      )}
    </section>
  );
}

function StatBox({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "good" | "warn" | "bad";
}) {
  const toneCls =
    tone === "good"
      ? "text-accent"
      : tone === "warn"
        ? "text-yellow-700"
        : tone === "bad"
          ? "text-destructive"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between text-muted-foreground text-sm">
          <span>{label}</span>
          {icon}
        </div>
        <p className={`mt-1 text-3xl font-bold ${toneCls}`}>{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function CategoryCard({
  tone,
  label,
  count,
  total,
}: {
  tone: "good" | "warn" | "bad";
  label: string;
  count: number;
  total: number;
}) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  const bar = tone === "good" ? "bg-accent" : tone === "warn" ? "bg-yellow-500" : "bg-destructive";
  const text =
    tone === "good" ? "text-accent" : tone === "warn" ? "text-yellow-700" : "text-destructive";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className={`text-xs font-medium ${text}`}>{pct}%</span>
        </div>
        <p className={`mt-1 text-3xl font-bold ${text}`}>
          {count}
          <span className="text-base text-muted-foreground font-normal"> / {total}</span>
        </p>
        <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}

function FacultyCalendarCard({
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  setViewMode,
  dailySummary,
  holidays,
  holidayReasons,
  applyPreset,
  todayIso,
}: {
  selectedMonth: number;
  setSelectedMonth: (m: number) => void;
  selectedYear: number;
  setSelectedYear: (y: number) => void;
  startDate: string;
  setStartDate: (d: string) => void;
  endDate: string;
  setEndDate: (d: string) => void;
  setViewMode: (v: "all" | "month" | "custom") => void;
  dailySummary: Record<string, { present: number; total: number; percent: number }>;
  holidays: Set<string>;
  holidayReasons: Record<string, string>;
  applyPreset: (preset: "thisMonth" | "30days" | "60days" | "90days") => void;
  todayIso: string;
}) {
  const firstDow = new Date(selectedYear, selectedMonth - 1, 1).getDay();
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const cells: (null | { date: string; day: number })[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ date: iso, day: d });
  }

  const handleCellClick = (iso: string) => {
    if (iso > todayIso) return;
    setViewMode("custom");
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
    <Card className="border-primary/20 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <div>
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <CalendarDays className="h-5 w-5 text-primary" /> Faculty Attendance Calendar & Date Calculator
          </CardTitle>
          <CardDescription className="mt-1">
            Click dates on the calendar or choose quick range presets to calculate percentage breakdown.
          </CardDescription>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-36">
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
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-28">
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
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-muted-foreground font-medium mr-1">Quick Presets:</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setViewMode("custom");
                applyPreset("thisMonth");
              }}
            >
              This Month
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setViewMode("custom");
                applyPreset("30days");
              }}
            >
              Last 30 Days
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setViewMode("custom");
                applyPreset("60days");
              }}
            >
              Last 60 Days
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setViewMode("custom");
                applyPreset("90days");
              }}
            >
              Last 90 Days
            </Button>
          </div>
          <div className="text-muted-foreground">
            Selection Range: <strong className="text-foreground">{startDate || "—"}</strong> to{" "}
            <strong className="text-foreground">{endDate || "—"}</strong>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-xs text-center text-muted-foreground mb-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="font-semibold py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((c, i) => {
            if (!c) return <div key={i} />;
            const isSunday = new Date(c.date).getDay() === 0;
            const isHoliday = holidays.has(c.date);
            const summary = dailySummary[c.date];
            const inRange = startDate && endDate && c.date >= startDate && c.date <= endDate;

            let cls = "bg-muted/40 text-muted-foreground";
            let label = "—";
            let sub = "";

            if (c.date > todayIso) {
              cls = "bg-muted/10 text-muted-foreground/30";
            } else if (isSunday) {
              cls = "bg-muted text-muted-foreground";
              label = "Sun";
            } else if (isHoliday) {
              cls = "bg-muted text-muted-foreground font-semibold";
              label = holidayReasons[c.date] ? "H" : "H";
            } else if (summary) {
              sub = `${summary.present}/${summary.total}`;
              label = `${summary.percent}%`;
              if (summary.percent >= 90) {
                cls = "bg-accent/20 text-accent font-bold hover:bg-accent/30";
              } else if (summary.percent >= 75) {
                cls = "bg-yellow-400/20 text-yellow-800 font-bold hover:bg-yellow-400/30";
              } else {
                cls = "bg-destructive/20 text-destructive font-bold hover:bg-destructive/30";
              }
            } else {
              cls = "bg-muted/20 text-muted-foreground/50";
            }

            return (
              <button
                type="button"
                key={i}
                onClick={() => handleCellClick(c.date)}
                disabled={c.date > todayIso}
                className={`aspect-square rounded-md flex flex-col items-center justify-center p-1 transition-all cursor-pointer ${cls} ${
                  inRange ? "ring-2 ring-primary ring-offset-1 z-10 shadow-xs" : ""
                }`}
                title={
                  holidayReasons[c.date] ||
                  (summary ? `${summary.present}/${summary.total} present` : "No attendance marked")
                }
              >
                <span className="text-xs font-semibold">{c.day}</span>
                <span className="text-[10px] font-medium">{label}</span>
                {sub && <span className="text-[9px] opacity-75">{sub}</span>}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
