import "./lib/error-capture";
import "./lib/sqlite-service.server";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

function isPublicAsset(pathname: string): boolean {
  return pathname.startsWith("/assets/") || pathname === "/favicon.ico" || pathname === "/logo.png" || pathname === "/robots.txt";
}

function isLastDayOfMonth() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  return tomorrow.getDate() === 1;
}

export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);

    // API route to manually trigger/test sending of monthly attendance reports
    if (url.pathname === "/api/trigger-monthly-reports") {
      const secret = url.searchParams.get("secret");
      if (secret === "race123") {
        const { sendMonthlyAttendanceReports } = await import("./lib/sqlite-service.server");
        ctx.waitUntil(sendMonthlyAttendanceReports());
        return new Response(JSON.stringify({ success: true, message: "Monthly report generation triggered successfully in the background." }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      } else {
        return new Response("Unauthorized", { status: 401 });
      }
    }

    // Diagnostics API route to test Resend integration live
    if (url.pathname === "/api/test-email") {
      const to = url.searchParams.get("to") || "chalukyanayakbk2@gmail.com";
      try {
        const apiKey = env?.RESEND_API_KEY || (typeof process !== "undefined" ? process.env.RESEND_API_KEY : undefined);
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "RESEND_API_KEY is not defined in worker env." }), {
            status: 400,
            headers: { "content-type": "application/json" }
          });
        }
        
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Attendance System <onboarding@resend.dev>",
            to,
            subject: "Test Email from Worker",
            html: "<p>If you see this, email sending works perfectly!</p>",
          }),
        });
        
        const resText = await res.text();
        return new Response(JSON.stringify({
          status: res.status,
          response: JSON.parse(resText),
          ok: res.ok
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "content-type": "application/json" }
        });
      }
    }

    if (env?.ASSETS && isPublicAsset(url.pathname)) {
      return env.ASSETS.fetch(request);
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },

  async scheduled(event: any, env: any, ctx: any) {
    // Run daily at midnight, but only execute emails on the last day of the month
    if (isLastDayOfMonth()) {
      const { sendMonthlyAttendanceReports } = await import("./lib/sqlite-service.server");
      ctx.waitUntil(sendMonthlyAttendanceReports());
    }
  }
};
