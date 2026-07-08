import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  CalendarCheck,
  GraduationCap,
  ShieldCheck,
  BarChart3,
  ShieldAlert,
  BrainCircuit,
  Cloud,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

const programs = [
  {
    icon: BarChart3,
    title: "M.Sc. in Business Analytics",
    tag: "UGC Recognised",
    partner: "Microsoft Azure",
    stat: "354% avg. hike",
  },
  {
    icon: ShieldAlert,
    title: "M.Tech. in Cybersecurity",
    tag: "AICTE Recognised",
    partner: "EC-Council · AWS · Azure",
    stat: "₹32L avg. salary",
  },
  {
    icon: BrainCircuit,
    title: "M.Tech. in Artificial Intelligence",
    tag: "AICTE Recognised",
    partner: "Microsoft Azure",
    stat: "₹30L avg. salary",
  },
  {
    icon: Cloud,
    title: "M.Sc. in Cloud Architecture & Security",
    tag: "UGC Recognised",
    partner: "AWS Academy · Azure",
    stat: "303% avg. hike",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3 font-semibold">
            <img src="/logo.png" className="h-10 w-10 object-contain" alt="REVA RACE Logo" />
            <span className="flex flex-col leading-tight">
              <span className="text-base">REVA RACE</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                Attendance Portal
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <a
              href="https://race.reva.edu.in"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground px-3 py-2"
            >
              race.reva.edu.in
            </a>
            <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
            <Link to="/auth">
              <Button className="bg-[#B8202E] hover:bg-[#9c1b27] text-white">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      <section
        className="relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #0B1E3F 0%, #14284d 55%, #B8202E 130%)",
        }}
      >
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="relative mx-auto max-w-6xl px-6 py-24 text-white">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F5B841]" />
            REVA University · School of Advanced Career Education
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            Attendance & class engagement for India's top-ranked{" "}
            <span className="text-[#F5B841]">PG programs</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/85">
            The official attendance portal for RACE learners and faculty across
            Business Analytics, Cybersecurity, Artificial Intelligence and Cloud
            Architecture cohorts.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth">
              <Button size="lg" className="bg-white text-[#0B1E3F] hover:bg-white/90">
                Student login <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button
                size="lg"
                variant="outline"
                className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                Faculty login
              </Button>
            </Link>
          </div>
          <div className="mt-12 grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              ["1000+", "Alumni"],
              ["100+", "Hiring partners"],
              ["50+", "Industry mentors"],
              ["#1", "ROI ranked"],
            ].map(([n, l]) => (
              <div key={l}>
                <div className="text-2xl font-bold text-[#F5B841]">{n}</div>
                <div className="text-xs uppercase tracking-wider text-white/70">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-[#B8202E]">
              Programs on the portal
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              Four programs. Four real outcomes.
            </h2>
          </div>
          <a
            href="https://race.reva.edu.in/programs/"
            target="_blank"
            rel="noreferrer"
            className="hidden md:inline-flex items-center gap-1 text-sm font-medium text-[#B8202E] hover:underline"
          >
            View all programs <ArrowRight className="h-4 w-4" />
          </a>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {programs.map((p) => (
            <div
              key={p.title}
              className="group rounded-2xl border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#0B1E3F] text-white">
                <p.icon className="h-5 w-5" />
              </span>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#B8202E]">
                {p.tag}
              </div>
              <h3 className="mt-1 text-lg font-semibold leading-snug">{p.title}</h3>
              <p className="mt-2 text-xs text-muted-foreground">In partnership with {p.partner}</p>
              <div className="mt-4 border-t pt-3 text-sm font-semibold text-[#0B1E3F]">
                {p.stat}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y bg-secondary/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-[#B8202E]">
              Built for RACE cohorts
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              One portal for weekend classes, mentors and learners.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Faculty run roll call in seconds. Learners check their attendance
              percentage, monthly calendar and cohort holidays anytime — on any device.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Cohort-aware classes across BA, CS, AI and Cloud tracks",
                "Automatic weekend + declared holiday handling",
                "Row-level security — every learner sees only their record",
                "Live attendance % with color-coded monthly calendar",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#B8202E]" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-[#0B1E3F] p-6 text-white shadow-lg">
              <GraduationCap className="h-6 w-6 text-[#F5B841]" />
              <h3 className="mt-4 font-semibold">For learners</h3>
              <p className="mt-1 text-sm text-white/75">
                Track your attendance %, view your monthly calendar and stay on
                top of eligibility.
              </p>
              <Link to="/auth">
                <Button size="sm" className="mt-4 bg-white text-[#0B1E3F] hover:bg-white/90">
                  Student login
                </Button>
              </Link>
            </div>
            <div className="rounded-2xl border bg-card p-6 shadow-sm sm:mt-8">
              <CalendarCheck className="h-6 w-6 text-[#B8202E]" />
              <h3 className="mt-4 font-semibold">For faculty</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage cohorts, mark daily attendance and publish holidays for the
                whole class.
              </p>
              <Link to="/auth">
                <Button size="sm" className="mt-4 bg-[#B8202E] hover:bg-[#9c1b27] text-white">
                  Faculty sign in
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 text-sm text-muted-foreground">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 text-[#B8202E]" />
          Data is protected with row-level security. Faculty see only their cohorts;
          learners see only their own attendance.
        </div>
      </section>

      <footer className="border-t bg-[#0B1E3F] text-white/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" className="h-8 w-8 object-contain" alt="REVA RACE Logo" />
            <div className="text-sm">
              <div className="font-semibold text-white">REVA RACE Attendance Portal</div>
              <div className="text-xs text-white/60">
                School of Advanced Career Education · REVA University
              </div>
            </div>
          </div>
          <div className="text-xs text-white/60">
            © {new Date().getFullYear()} REVA University. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
