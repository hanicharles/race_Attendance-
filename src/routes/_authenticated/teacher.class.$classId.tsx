import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { monthDays, MONTH_NAMES } from "@/lib/attendance";

export const Route = createFileRoute("/_authenticated/teacher/class/$classId")({
  component: ClassDetail,
});

type Student = { id: string; name: string; email: string; gender: string; quota: string; stream: string; user_id: string | null };
type Klass = { id: string; name: string; section: string | null; subject: string | null };

function ClassDetail() {
  const { classId } = Route.useParams();
  const [klass, setKlass] = useState<Klass | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", gender: "Male", quota: "PGCET", stream: "CS" });

  const load = useCallback(async () => {
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from("classes").select("*").eq("id", classId).maybeSingle(),
      supabase.from("students").select("*").eq("class_id", classId).order("name"),
    ]);
    setKlass(c as Klass);
    setStudents((s as Student[]) ?? []);
  }, [classId]);
  useEffect(() => { load(); }, [load]);

  const addStudent = async () => {
    if (!form.name.trim() || !form.email.trim()) return toast.error("Name and email required");
    const { error } = await supabase.from("students").insert({ class_id: classId, ...form, email: form.email.trim().toLowerCase() });
    if (error) return toast.error(error.message);
    toast.success("Student added");
    setAddOpen(false);
    setForm({ name: "", email: "", gender: "Male", quota: "PGCET", stream: "CS" });
    load();
  };

  const removeStudent = async (id: string) => {
    if (!confirm("Delete this student and all their attendance?")) return;
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-6">
      <Link to="/teacher" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to classes
      </Link>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">{klass?.name ?? "…"}</h1>
          <p className="text-muted-foreground">{[klass?.section, klass?.subject].filter(Boolean).join(" · ") || "—"}</p>
        </div>
        <Button
          variant="outline"
          className="text-muted-foreground hover:text-destructive hover:border-destructive"
          onClick={async () => {
            if (klass && confirm(`Are you sure you want to delete the class "${klass.name}"? This will delete all student rosters and attendance records in this class.`)) {
              const { error } = await supabase.from("classes").delete().eq("id", classId);
              if (error) {
                toast.error(error.message);
              } else {
                toast.success("Class deleted");
                window.location.href = "/teacher";
              }
            }
          }}
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          Delete class
        </Button>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">Take attendance</TabsTrigger>
          <TabsTrigger value="matrix">Monthly matrix</TabsTrigger>
          <TabsTrigger value="students">Students ({students.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance">
          <TakeAttendance students={students} />
        </TabsContent>

        <TabsContent value="matrix">
          <MonthlyMatrix students={students} />
        </TabsContent>

        <TabsContent value="students">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>Roster</CardTitle><CardDescription>Add and manage students in this class.</CardDescription></div>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Add student</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add student</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Full name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                    <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                      <p className="text-xs text-muted-foreground mt-1">The student uses this email to sign up.</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label>Gender</Label>
                        <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div><Label>Quota</Label>
                        <Select value={form.quota} onValueChange={(v) => setForm({ ...form, quota: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="PGCET">PGCET</SelectItem><SelectItem value="Management">Management</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div><Label>Stream</Label>
                        <Select value={form.stream} onValueChange={(v) => setForm({ ...form, stream: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="CS">CS</SelectItem><SelectItem value="AI">AI</SelectItem></SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <DialogFooter><Button onClick={addStudent}>Add</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <p className="text-muted-foreground text-sm">No students yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground border-b">
                      <tr><th className="py-2">Name</th><th>Email</th><th>Stream</th><th>Quota</th><th>Login</th><th></th></tr>
                    </thead>
                    <tbody>
                      {students.map((s) => (
                        <tr key={s.id} className="border-b last:border-0">
                          <td className="py-2 font-medium">
                            <Link to="/teacher/student/$studentId" params={{ studentId: s.id }} className="hover:underline text-primary">
                              {s.name}
                            </Link>
                          </td>
                          <td>{s.email}</td>
                          <td>{s.stream}</td>
                          <td>{s.quota}</td>
                          <td>{s.user_id ? <span className="text-accent">Linked</span> : <span className="text-muted-foreground">Pending signup</span>}</td>
                          <td className="text-right"><Button size="sm" variant="ghost" onClick={() => removeStudent(s.id)}><Trash2 className="h-4 w-4" /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

function TakeAttendance({ students }: { students: Student[] }) {
  const [date, setDate] = useState(todayISO());
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayReason, setHolidayReason] = useState("");
  const [holidayId, setHolidayId] = useState<string | null>(null);
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false);
  const [newHolidayReason, setNewHolidayReason] = useState("");

  const checkHolidayStatus = useCallback(async (selectedDate: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (uid) {
        const { data: hData } = await supabase
          .from("holidays")
          .select("id,reason")
          .eq("teacher_id", uid)
          .eq("holiday_date", selectedDate)
          .maybeSingle();

        if (hData) {
          setIsHoliday(true);
          setHolidayReason(hData.reason || "Holiday");
          setHolidayId(hData.id);
        } else {
          setIsHoliday(false);
          setHolidayReason("");
          setHolidayId(null);
        }
      }
    } catch (err) {
      console.error("Error checking holiday status:", err);
    }
  }, []);

  useEffect(() => {
    if (students.length === 0) return;
    (async () => {
      const ids = students.map(s => s.id);
      const { data } = await supabase.from("attendance").select("student_id,status").in("student_id", ids).eq("date", date);
      const m: Record<string, number> = {};
      students.forEach(s => { m[s.id] = 1; });
      (data ?? []).forEach((r: { student_id: string; status: number }) => { m[r.student_id] = Number(r.status); });
      setMarks(m);
      await checkHolidayStatus(date);
    })();
  }, [date, students, checkHolidayStatus]);

  const set = (id: string, v: number) => setMarks(prev => ({ ...prev, [id]: v }));

  const save = async () => {
    setSaving(true);
    const rows = students.map(s => ({ student_id: s.id, date, status: marks[s.id] ?? 1 }));
    const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "student_id,date" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Attendance saved");
  };

  const handleAddHoliday = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    
    const { error } = await supabase.from("holidays").insert({
      teacher_id: uid,
      holiday_date: date,
      reason: newHolidayReason.trim() || null
    });
    
    if (error) return toast.error(error.message);
    toast.success("Holiday marked for this date");
    setHolidayDialogOpen(false);
    setNewHolidayReason("");
    await checkHolidayStatus(date);
  };

  const handleRemoveHoliday = async () => {
    if (!holidayId) return;
    const { error } = await supabase.from("holidays").delete().eq("id", holidayId);
    if (error) return toast.error(error.message);
    toast.success("Holiday removed");
    await checkHolidayStatus(date);
  };

  if (students.length === 0) return <Card><CardContent className="py-10 text-center text-muted-foreground">Add students first.</CardContent></Card>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <div>
          <CardTitle>Roll call</CardTitle>
          <CardDescription>Mark each student. 1 = Present, 0.5 = Half day, 0 = Absent.</CardDescription>
        </div>
        <div className="flex items-end gap-2">
          <div><Label>Date</Label><Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></div>
          {!isHoliday ? (
            <Dialog open={holidayDialogOpen} onOpenChange={setHolidayDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-orange-200 hover:bg-orange-50 text-orange-700 hover:text-orange-900">
                  Mark as Holiday
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Mark {new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })} as a Holiday</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <Label>Reason (optional)</Label>
                  <Input value={newHolidayReason} onChange={(e) => setNewHolidayReason(e.target.value)} placeholder="e.g. Convocation, Festival" />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setHolidayDialogOpen(false)}>Cancel</Button>
                  <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={handleAddHoliday}>Mark Holiday</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
          <Button onClick={save} disabled={saving || isHoliday}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </CardHeader>
      {isHoliday && (
        <div className="mx-6 p-4 bg-orange-50 border border-orange-200 text-orange-800 rounded-xl flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
            <span>This date is marked as a <strong>Holiday ({holidayReason})</strong>. Attendance values are ignored for metrics on holidays.</span>
          </span>
          <Button size="sm" variant="ghost" className="text-orange-800 hover:text-red-700 hover:bg-orange-100" onClick={handleRemoveHoliday}>
            Remove Holiday
          </Button>
        </div>
      )}
      <CardContent className={isHoliday ? "opacity-60" : ""}>
        <ul className="divide-y">
          {students.map((s) => {
            const v = marks[s.id] ?? 1;
            return (
              <li key={s.id} className="py-3 flex items-center justify-between gap-4">
                <div><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.email}</p></div>
                <div className="flex gap-1">
                  {isHoliday ? (
                    <span className="text-xs font-semibold px-3 py-1.5 bg-muted text-muted-foreground rounded-lg border">
                      Holiday (H)
                    </span>
                  ) : (
                    [{v:1,l:"P"},{v:0.5,l:"½"},{v:0,l:"A"}].map(opt => (
                      <Button key={opt.v} size="sm" variant={v === opt.v ? "default" : "outline"} onClick={() => set(s.id, opt.v)}>
                        {opt.l}
                      </Button>
                    ))
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

type Row = { student: Student; days: Record<string, number | "H">; percent: number };

function MonthlyMatrix({ students }: { students: Student[] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<Row[]>([]);
  const [dates, setDates] = useState<{ date: string; type: "W" | "H" }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { data: holidayRows } = await supabase.from("holidays").select("holiday_date").eq("teacher_id", userData.user!.id);
      const holidays = new Set((holidayRows ?? []).map((r: { holiday_date: string }) => r.holiday_date));
      const ds = monthDays(year, month, holidays);
      setDates(ds);
      if (students.length === 0) { setRows([]); return; }
      const ids = students.map(s => s.id);
      const { data: att } = await supabase.from("attendance").select("student_id,date,status").in("student_id", ids).gte("date", ds[0]?.date ?? "").lte("date", ds[ds.length-1]?.date ?? "");
      const map = new Map<string, number>();
      (att ?? []).forEach((r: { student_id: string; date: string; status: number }) => map.set(`${r.student_id}_${r.date}`, Number(r.status)));
      const built: Row[] = students.map((s) => {
        const days: Record<string, number | "H"> = {};
        let total = 0, present = 0;
        ds.forEach((d) => {
          if (d.type === "H") { days[d.date] = "H"; return; }
          const v = map.get(`${s.id}_${d.date}`);
          if (v === undefined) {
            // Unmarked day
            days[d.date] = "—" as never;
            return;
          }
          days[d.date] = v;
          total += 1; present += v;
        });
        return { student: s, days, percent: total ? Math.round((present/total)*1000)/10 : 0 };
      });
      setRows(built);
    })();
  }, [year, month, students]);

  const years = useMemo(() => [2024, 2025, 2026, 2027], []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle>Matrix — {MONTH_NAMES[month-1]} {year}</CardTitle>
        <div className="flex gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTH_NAMES.map((n, i) => <SelectItem key={i} value={String(i+1)}>{n}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing to show.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-card text-left p-2 border-b">Student</th>
                  {dates.map(d => <th key={d.date} className="p-1 border-b text-center min-w-[28px]">{d.date.slice(-2)}</th>)}
                  <th className="p-2 border-b text-center">%</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.student.id}>
                    <td className="sticky left-0 bg-card p-2 border-b font-medium whitespace-nowrap">{r.student.name}</td>
                    {dates.map(d => {
                      const v = r.days[d.date];
                      const cls = v === "H" ? "bg-muted text-muted-foreground"
                        : v === 1 ? "bg-accent/20 text-accent"
                        : v === 0 ? "bg-destructive/20 text-destructive"
                        : v === 0.5 ? "bg-yellow-400/20 text-yellow-800"
                        : "bg-muted/10 text-muted-foreground/30";
                      const label = v === "H" ? "H" : v === 1 ? "P" : v === 0 ? "A" : v === 0.5 ? "½" : "—";
                      return <td key={d.date} className={`p-1 border-b text-center ${cls}`}>{label}</td>;
                    })}
                    <td className="p-2 border-b text-center font-semibold">{r.percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}