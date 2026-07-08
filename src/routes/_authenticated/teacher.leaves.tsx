import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Check, X, Mail } from "lucide-react";

export const Route = createFileRoute("/_authenticated/teacher/leaves")({
  component: LeaveRequestsPage,
});

type LeaveRow = {
  id: string;
  leave_date: string;
  reason: string | null;
  status: string;
  teacher_note: string | null;
  created_at: string;
  student_id: string;
  students: { id: string; name: string; email: string; class_id: string; classes: { name: string } | null } | null;
};

function LeaveRequestsPage() {
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("leave_requests")
      .select("id,leave_date,reason,status,teacher_note,created_at,student_id,students(id,name,email,class_id,classes(name))")
      .order("leave_date", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as unknown as LeaveRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const decide = async (r: LeaveRow, status: "approved" | "rejected") => {
    const { error } = await supabase.from("leave_requests").update({ status }).eq("id", r.id);
    if (error) return toast.error(error.message);
    // If approved, mark attendance as absent (0) for that date.
    if (status === "approved") {
      const { data: existing } = await supabase
        .from("attendance").select("id")
        .eq("student_id", r.student_id).eq("date", r.leave_date).maybeSingle();
      const { error: aErr } = existing
        ? await supabase.from("attendance").update({ status: 0 }).eq("id", existing.id)
        : await supabase.from("attendance").insert({ student_id: r.student_id, date: r.leave_date, status: 0 });
      if (aErr) toast.error(`Approved, but attendance not marked: ${aErr.message}`);
    }
    toast.success(`Leave ${status}`);
    load();
  };

  const filtered = filter === "all" ? rows : rows.filter(r => r.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/teacher"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Mail className="h-5 w-5" /> Leave requests</h1>
            <p className="text-sm text-muted-foreground">Approve or reject leave requests from your students.</p>
          </div>
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          No {filter === "all" ? "" : filter} leave requests.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(r => (
            <Card key={r.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="text-lg">{r.students?.name ?? "Unknown"}</CardTitle>
                    <CardDescription>
                      {r.students?.classes?.name ?? "—"} · {r.students?.email}
                    </CardDescription>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">Date: </span>
                  <span className="font-semibold">{new Date(r.leave_date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                {r.reason && (
                  <div className="text-sm rounded-md bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Reason</p>
                    {r.reason}
                  </div>
                )}
                {r.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => decide(r, "approved")}><Check className="h-4 w-4 mr-1" />Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => decide(r, "rejected")}><X className="h-4 w-4 mr-1" />Reject</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "approved" ? "bg-accent/20 text-accent" :
    status === "rejected" ? "bg-destructive/20 text-destructive" :
    "bg-yellow-500/20 text-yellow-800";
  return <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cls}`}>{status}</span>;
}