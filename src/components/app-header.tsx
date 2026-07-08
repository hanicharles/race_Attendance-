import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CalendarCheck, LogOut, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";

export function AppHeader({ title }: { title?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, role } = useAuth();

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CalendarCheck className="h-4 w-4" />
            </span>
            AttendPro
          </Link>
          {title && <span className="hidden sm:inline text-sm text-muted-foreground">/ {title}</span>}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end text-xs leading-tight">
            <span className="text-foreground font-medium">{user?.email}</span>
            {role && <span className="text-muted-foreground capitalize">{role}</span>}
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/profile"><UserRound className="h-4 w-4 mr-1" />Profile</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-1" />Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}