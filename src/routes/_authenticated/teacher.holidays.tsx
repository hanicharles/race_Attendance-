import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/teacher/holidays")({
  component: Holidays,
});

type Holiday = { id: string; holiday_date: string; reason: string | null };

function Holidays() {
  const [items, setItems] = useState<Holiday[]>([]);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");

  const load = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("holidays")
      .select("id,holiday_date,reason")
      .eq("teacher_id", userData.user!.id)
      .order("holiday_date", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data as Holiday[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!date) return toast.error("Pick a date");
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("holidays").insert({
      teacher_id: userData.user!.id, holiday_date: date, reason: reason || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Holiday added");
    setDate(""); setReason(""); load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("holidays").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-6">
      <Link to="/teacher" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to classes
      </Link>
      <h1 className="text-3xl font-bold">Holidays</h1>

      <Card>
        <CardHeader><CardTitle>Add holiday</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="flex-1 min-w-[200px]"><Label>Reason (optional)</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <Button onClick={add}>Add</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{items.length} holidays</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-muted-foreground text-sm">No holidays yet.</p>
          ) : (
            <ul className="divide-y">
              {items.map((h) => (
                <li key={h.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{h.holiday_date}</p>
                    <p className="text-sm text-muted-foreground">{h.reason || "—"}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => remove(h.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}