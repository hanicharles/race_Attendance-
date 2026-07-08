import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

type StudentInfo = {
  name: string; email: string; stream: string; quota: string; gender: string;
  official_email?: string | null; mobile_number?: string | null; pgcet_num?: string | null; joining_date?: string | null;
  classes: { name: string; section: string | null; subject: string | null } | null;
} | null;

function ProfilePage() {
  const { user, role } = useAuth();
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [student, setStudent] = useState<StudentInfo>(null);
  const [newPw, setNewPw] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      setFullName(p?.full_name ?? "");
      const { data: s } = await supabase
        .from("students")
        .select("name,email,stream,quota,gender,official_email,mobile_number,pgcet_num,joining_date,classes(name,section,subject)")
        .eq("user_id", user.id)
        .maybeSingle();
      if (s) setStudent(s as unknown as StudentInfo);
    })();
  }, [user]);

  const saveName = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
  };

  const changePw = async () => {
    if (newPw.length < 6) return toast.error("Password must be at least 6 characters");
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) return toast.error(error.message);
    setNewPw("");
    toast.success("Password changed");
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Profile" />
      <main className="mx-auto max-w-3xl px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Your login details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
            <div><Label>Role</Label><Input value={role ?? ""} disabled className="capitalize" /></div>
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <Button onClick={saveName} disabled={saving}>{saving ? "Saving…" : "Save name"}</Button>
          </CardContent>
        </Card>

        {student && (
          <Card>
            <CardHeader>
              <CardTitle>Student details</CardTitle>
              <CardDescription>Managed by your faculty.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div><Label>Name</Label><Input value={student.name} disabled /></div>
              <div><Label>Class</Label><Input value={[student.classes?.name, student.classes?.section, student.classes?.subject].filter(Boolean).join(" · ")} disabled /></div>
              <div><Label>Stream</Label><Input value={student.stream} disabled /></div>
              <div><Label>Quota</Label><Input value={student.quota} disabled /></div>
              <div><Label>Gender</Label><Input value={student.gender} disabled /></div>
              {student.official_email && <div><Label>Official Email</Label><Input value={student.official_email} disabled /></div>}
              {student.mobile_number && <div><Label>Mobile Number</Label><Input value={student.mobile_number} disabled /></div>}
              {student.pgcet_num && <div><Label>PGCET Number</Label><Input value={student.pgcet_num} disabled /></div>}
              {student.joining_date && <div><Label>Date of Joining</Label><Input value={student.joining_date} disabled /></div>}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>Update your account password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div><Label htmlFor="pw">New password</Label><Input id="pw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} /></div>
            <Button onClick={changePw}>Update password</Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}