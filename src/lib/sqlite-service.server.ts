import { createClient } from "@libsql/client";
import * as crypto from "node:crypto";
import * as path from "node:path";

// Initialize SQLite database
const dbDir = process.cwd();
const dbPath = path.join(dbDir, "sqlite.db");

let dbInstance: any = null;
let isInitialized = false;

function getDb() {
  if (dbInstance) return dbInstance;

  const connectionUrl = process.env.TURSO_CONNECTION_URL || `file:${dbPath}`;
  const authToken = process.env.TURSO_AUTH_TOKEN || "";

  console.log(`[SQLite Server] Lazy-initializing database client: ${connectionUrl}`);

  try {
    const isCloudflare = typeof globalThis !== "undefined" && (
      !(globalThis as any).process?.versions?.node ||
      (globalThis as any).navigator?.userAgent === "Cloudflare-Workers" ||
      (globalThis as any).process?.env?.CF_PAGES === "1"
    );
    if (isCloudflare && !process.env.TURSO_CONNECTION_URL) {
      console.warn("[SQLite Server] Running in Cloudflare but TURSO_CONNECTION_URL is not set. Database client mocked.");
      dbInstance = {
        execute: async () => {
          throw new Error("Database not configured. Since you are deploying to a serverless platform (like Cloudflare Pages), a local SQLite file database cannot be used. Please set up a hosted SQLite database (such as Turso) and configure the TURSO_CONNECTION_URL and TURSO_AUTH_TOKEN environment variables in your Cloudflare Pages dashboard settings (under Settings -> Environment Variables). See the cloudflare_deployment.md file in your project for step-by-step instructions.");
        }
      };
    } else {
      dbInstance = createClient({
        url: connectionUrl,
        authToken: authToken,
      });
    }
  } catch (err: any) {
    console.error("[SQLite Server] Failed to initialize database client:", err);
    let message = err.message || "";
    if (connectionUrl.startsWith("file:") && (message.includes("URL_SCHEME_NOT_SUPPORTED") || message.includes("only supports"))) {
      message = "Database not configured. Since you are deploying to a serverless platform (like Cloudflare Pages), a local SQLite file database cannot be used. Please set up a hosted SQLite database (such as Turso) and configure the TURSO_CONNECTION_URL and TURSO_AUTH_TOKEN environment variables in your Cloudflare Pages dashboard settings (under Settings -> Environment Variables). See the cloudflare_deployment.md file in your project for step-by-step instructions.";
    }
    dbInstance = {
      execute: async () => {
        throw new Error("Database connection error: " + message);
      }
    };
  }

  return dbInstance;
}

// Proxied database client to lazily load and initialize the schema on the first query
const db = new Proxy({} as any, {
  get(target, prop) {
    return async (...args: any[]) => {
      const client = getDb();
      if (!isInitialized) {
        isInitialized = true;
        try {
          await initDb();
        } catch (err) {
          console.error("[SQLite Server] Lazy schema initialization failed:", err);
        }
      }
      if (typeof client[prop] === "function") {
        return client[prop](...args);
      }
      return client[prop];
    };
  }
});

// Setup schema tables
async function initDb() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS auth_users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(id) REFERENCES auth_users(id) ON DELETE CASCADE
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_roles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        UNIQUE(user_id, role),
        FOREIGN KEY(user_id) REFERENCES auth_users(id) ON DELETE CASCADE
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY,
        teacher_id TEXT NOT NULL,
        name TEXT NOT NULL,
        section TEXT,
        subject TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(teacher_id) REFERENCES auth_users(id) ON DELETE CASCADE
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL,
        user_id TEXT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        gender TEXT NOT NULL DEFAULT 'Male',
        quota TEXT NOT NULL DEFAULT 'PGCET',
        stream TEXT NOT NULL DEFAULT 'CS',
        official_email TEXT,
        mobile_number TEXT,
        pgcet_num TEXT,
        joining_date TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(class_id, email),
        FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES auth_users(id) ON DELETE SET NULL
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS holidays (
        id TEXT PRIMARY KEY,
        teacher_id TEXT NOT NULL,
        holiday_date TEXT NOT NULL,
        reason TEXT,
        UNIQUE(teacher_id, holiday_date),
        FOREIGN KEY(teacher_id) REFERENCES auth_users(id) ON DELETE CASCADE
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        date TEXT NOT NULL,
        status REAL NOT NULL DEFAULT 1.0,
        created_at TEXT NOT NULL,
        UNIQUE(student_id, date),
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        leave_date TEXT NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        teacher_note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(student_id, leave_date),
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES auth_users(id) ON DELETE CASCADE
      );
    `);

    // Indexes
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);`);

    // Seed default teacher if not exists
    const teacherId = "4ab7ebf7-000c-47f9-8f50-fa669ed0e4c8";
    const existingTeacher = await db.execute({
      sql: "SELECT 1 FROM auth_users WHERE id = ?",
      args: [teacherId],
    });

    if (existingTeacher.rows.length === 0) {
      console.log("[SQLite Server] Seeding RACE faculty and classes...");
      const email = "RACE@reva.edu.in";
      const pwHash = hashPassword("Admin@race");
      const now = new Date().toISOString();

      await db.execute({
        sql: "INSERT INTO auth_users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
        args: [teacherId, email, pwHash, now],
      });

      await db.execute({
        sql: "INSERT INTO profiles (id, full_name, email, created_at) VALUES (?, ?, ?, ?)",
        args: [teacherId, "RACE Faculty", email, now],
      });

      await db.execute({
        sql: "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)",
        args: [crypto.randomUUID(), teacherId, "teacher"],
      });

      const classId = "88a647b7-4450-4341-a5a5-e6721feb819a";
      await db.execute({
        sql: "INSERT INTO classes (id, name, teacher_id, subject, section, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        args: [classId, "Full time Batch 04 AY2025-27", teacherId, "PG Program", "FT-04", now],
      });

      const studentsData = [
        { name: 'Sai krishna k m', email: 'saikrish172003@gmail.com', quota: 'PGCET', stream: 'MTech CS', joiningDate: '18/11/2025', officialEmail: 'pgcet2501001@reva.edu.in', mobile: '9141428452', pgcetNum: '2501001', gender: 'Male' },
        { name: 'Shashwath K S', email: 'shashwathkukunoor@gmail.com', quota: 'PGCET', stream: 'MTech AI', joiningDate: '18/11/2025', officialEmail: 'pgcet2501009@reva.edu.in', mobile: '9945005114', pgcetNum: '2501009', gender: 'Male' },
        { name: 'Sewana M', email: 'sewanamudigal@gmail.com', quota: 'PGCET', stream: 'MTech CS', joiningDate: '18/11/2025', officialEmail: 'pgcet2500971@reva.edu.in', mobile: '8904488242', pgcetNum: '2500971', gender: 'Male' },
        { name: 'Ambika Yallal', email: 'ambika.ry2000@gmail.com', quota: 'PGCET', stream: 'MTech AI', joiningDate: '10-10-2025', officialEmail: 'pgcet2500946@reva.edu.in', mobile: '9845148754', pgcetNum: '2500946', gender: 'Female' },
        { name: 'Aishwarya L Pujeri', email: 'aishwaryapujeri23@gmail.com', quota: 'PGCET', stream: 'MTech AI', joiningDate: '29/10/2025', officialEmail: 'pgcet2500999@reva.edu.in', mobile: '8073249441', pgcetNum: '2500999', gender: 'Female' },
        { name: 'Alina Shibu', email: 'alinamercy@gmail.com', quota: 'PGCET', stream: 'MTech AI', joiningDate: '29/10/2025', officialEmail: 'pgcet2500959@reva.edu.in', mobile: '8147931652', pgcetNum: '2500959', gender: 'Female' },
        { name: 'Bhagyashree C Patil', email: 'bhagyashreepatil0903@gmail.com', quota: 'PGCET', stream: 'MTech AI', joiningDate: '29/10/2025', officialEmail: 'pgcet2500996@reva.edu.in', mobile: '7676428044', pgcetNum: '2500996', gender: 'Female' },
        { name: 'Chalukya Nayaka B K', email: 'chalukyanayakabk2@gmail.com', quota: 'PGCET', stream: 'MTech CS', joiningDate: '18/11/2025', officialEmail: 'pgcet2501064@reva.edu.in', mobile: '9591225555', pgcetNum: '2501064', gender: 'Male' },
        { name: 'Shilpa J', email: 'shilpaj18204@gmail.com', quota: 'PGCET', stream: 'MTech AI', joiningDate: '29/10/2025', officialEmail: 'pgcet2500992@reva.edu.in', mobile: '7760874405', pgcetNum: '2500992', gender: 'Female' },
        { name: 'Janhvi Jeevan Revankar', email: 'revankarjanhvi@gmail.com', quota: 'PGCET', stream: 'MTech CS', joiningDate: '29/10/2025', officialEmail: 'pgcet2501013@reva.edu.in', mobile: '7483790438', pgcetNum: '2501013', gender: 'Female' },
        { name: 'Kondamadugula venkateshwara reddy', email: 'kvenkatreddy1414@gmail.com', quota: 'PGCET', stream: 'MTech CS', joiningDate: '18//11/2025', officialEmail: 'pgcet2501089@reva.edu.in', mobile: '7975545680', pgcetNum: '2501089', gender: 'Male' },
        { name: 'Sreediya S', email: 'sreediyasanjith26@gmail.com', quota: 'PGCET', stream: 'MTech CS', joiningDate: '09/10/2025', officialEmail: 'pgcet2500787@reva.edu.in', mobile: '8105201899', pgcetNum: '2500787', gender: 'Female' },
        { name: 'Nithya T M', email: 'nithyatm045@gmail.com', quota: 'PGCET', stream: 'MTech CS', joiningDate: '30/10/2025', officialEmail: 'pgcet2501072@reva.edu.in', mobile: '910618926', pgcetNum: '2501072', gender: 'Female' },
        { name: 'Lakshmi Shivani K', email: 'lakshmishivanik.19@gmail.com', quota: 'PGCET', stream: 'MTech CS', joiningDate: '09/10/2025', officialEmail: 'pgcet2500797@reva.edu.in', mobile: '9535463787', pgcetNum: '2500797', gender: 'Female' },
        { name: 'Jothika B', email: 'jothikachandra2027@gmail.com', quota: 'PGCET', stream: 'MTech AI', joiningDate: '18/11/2025', officialEmail: 'pgcet2500758@reva.edu.in', mobile: '9741150810', pgcetNum: '2500758', gender: 'Female' },
        { name: 'Sneha S', email: 'nalini2952002@gmail.com', quota: 'PGCET', stream: 'MTech AI', joiningDate: '18/11/2025', officialEmail: 'pgcet2501015@reva.edu.in', mobile: '6361721470', pgcetNum: '', gender: 'Female' },
        { name: 'B Meenu', email: 'meenub255@gmail.com', quota: 'MQ', stream: 'MTech AI', joiningDate: '18/11/2025', officialEmail: 'Meenu.AIFT25@race.reva.edu.in', mobile: '9008557126', pgcetNum: '580', gender: 'Female' },
        { name: 'Kaarthikeyen G', email: 'g.kaarthik12@gmail.com', quota: 'MQ', stream: 'M.Sc CS', joiningDate: '18/11/2025', officialEmail: 'Kaarthikeyen.CSFT25@race.reva.edu.in', mobile: '7200845465', pgcetNum: '937', gender: 'Male' },
        { name: 'Shaan Abraham', email: 'shaanabraham04@gmail.com', quota: 'MQ', stream: 'M.Sc CS', joiningDate: '18/11/2025', officialEmail: 'Shaan.CSFT25@race.reva.edu.in', mobile: '8431397516', pgcetNum: '1057', gender: 'Male' },
        { name: 'Mevada Vinit', email: 'vinitmevada0253v@gmail.com', quota: 'MQ', stream: 'MTech CS', joiningDate: '18/11/2025', officialEmail: 'Mevada.CSFT25@race.reva.edu.in', mobile: '9099442190', pgcetNum: '1121', gender: 'Male' },
        { name: 'Dhanusha G', email: 'dhanusha.govind99@gmaila.com', quota: 'PGCET', stream: 'MTech AI', joiningDate: '18/11/2025', officialEmail: 'pgcet2500907@race.reva.edu.in', mobile: '9731326208', pgcetNum: '2500907', gender: 'Female' },
        { name: 'Dattaguru Chettiar', email: 'gurudatta229028@gmail.com', quota: 'MQ', stream: 'MSc CS', joiningDate: '18/11/2025', officialEmail: 'dattaguru.csft25@race.reva.edu.in', mobile: '9004230088', pgcetNum: '1112', gender: 'Male' },
        { name: 'Avish T S', email: 'avishts18@gmail.com', quota: 'PGCET', stream: 'MTech AI', joiningDate: '18/11/2025', officialEmail: 'pgcet2501106@reva.edu.in', mobile: '7338679989', pgcetNum: '2501106', gender: 'Male' },
        { name: 'Veda Shivayogi Ramagondanahalli', email: 'vedaram2002@gmail.com', quota: 'PGCET', stream: 'MTech AI', joiningDate: '3/12/2025', officialEmail: 'pgcet2500791@reva.edu.in', mobile: '9481232907', pgcetNum: '', gender: 'Female' },
        { name: 'Rajendra Rathod', email: 'rajprathod06@gmail.com', quota: 'PGCET', stream: 'MTech CS', joiningDate: '4/12/2025', officialEmail: 'pgcet2500947@reva.edu.in', mobile: '7760199226', pgcetNum: '', gender: 'Male' },
        { name: 'Ayesha', email: 'pgcet2501117@reva.edu.in', quota: 'PGCET', stream: 'MTech CS', joiningDate: '', officialEmail: 'pgcet2501117@reva.edu.in', mobile: '', pgcetNum: '', gender: 'Female' }
      ];

      for (const s of studentsData) {
        const studentId = crypto.randomUUID();
        const studentUserId = crypto.randomUUID();
        const stdPwHash = hashPassword("std@123");

        // 1. Create auth user
        await db.execute({
          sql: "INSERT INTO auth_users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
          args: [studentUserId, s.email.toLowerCase(), stdPwHash, now],
        });

        // 2. Create profile
        await db.execute({
          sql: "INSERT INTO profiles (id, full_name, email, created_at) VALUES (?, ?, ?, ?)",
          args: [studentUserId, s.name, s.email.toLowerCase(), now],
        });

        // 3. Create role
        await db.execute({
          sql: "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)",
          args: [crypto.randomUUID(), studentUserId, "student"],
        });

        // 4. Create student record
        await db.execute({
          sql: `INSERT INTO students (id, class_id, user_id, name, email, gender, quota, stream, official_email, mobile_number, pgcet_num, joining_date, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [studentId, classId, studentUserId, s.name, s.email.toLowerCase(), s.gender, s.quota, s.stream, s.officialEmail || null, s.mobile || null, s.pgcetNum || null, s.joiningDate || null, now],
        });
      }

      console.log("[SQLite Server] Seeding holidays...");
      const holidays = [
        { date: "2025-11-27", reason: "Holiday due to Convocation" },
        { date: "2026-03-04", reason: "Regular classes are suspended due to Holi" },
        { date: "2026-05-01", reason: "Holiday / May Day" },
        { date: "2026-05-03", reason: "Week off" },
        { date: "2026-05-04", reason: "Week off" },
        { date: "2026-05-22", reason: "Bakrid Holiday" }
      ];

      // Add all Mondays as holidays
      const start = new Date(2025, 10, 1);
      const end = new Date(2026, 5, 1);
      const current = new Date(start);
      while (current < end) {
        if (current.getDay() === 1) { // 1 = Monday
          const yr = current.getFullYear();
          const mo = String(current.getMonth() + 1).padStart(2, '0');
          const dy = String(current.getDate()).padStart(2, '0');
          const mondayStr = `${yr}-${mo}-${dy}`;
          if (!holidays.some(h => h.date === mondayStr)) {
            holidays.push({ date: mondayStr, reason: "Monday Weekly Off" });
          }
        }
        current.setDate(current.getDate() + 1);
      }

      for (const h of holidays) {
        await db.execute({
          sql: "INSERT INTO holidays (id, teacher_id, holiday_date, reason) VALUES (?, ?, ?, ?)",
          args: [crypto.randomUUID(), teacherId, h.date, h.reason]
        });
      }

      console.log("[SQLite Server] Seeding attendance history...");
      const classDates = [
        "2025-11-18", "2025-11-19", "2025-11-20", "2025-11-21", "2025-11-22", "2025-11-25", "2025-11-26", "2025-11-28", "2025-11-29",
        "2025-12-02", "2025-12-03", "2025-12-04", "2025-12-05", "2025-12-06", "2025-12-07", "2025-12-08", "2025-12-10", "2025-12-11", "2025-12-12", "2025-12-13", "2025-12-16", "2025-12-17", "2025-12-18", "2025-12-19", "2025-12-20",
        "2026-01-03", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09", "2026-01-10", "2026-01-13", "2026-01-14", "2026-01-20", "2026-01-21", "2026-01-22", "2026-01-23", "2026-01-24", "2026-01-27", "2026-01-28", "2026-01-29", "2026-01-30", "2026-01-31",
        "2026-02-03", "2026-02-04", "2026-02-05", "2026-02-06", "2026-02-07", "2026-02-10", "2026-02-11", "2026-02-12", "2026-02-13", "2026-02-14", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20", "2026-02-21", "2026-02-24", "2026-02-25", "2026-02-26", "2026-02-27", "2026-02-28",
        "2026-03-03", "2026-03-05", "2026-03-06", "2026-03-07", "2026-03-10", "2026-03-11", "2026-03-12", "2026-03-13", "2026-03-14", "2026-03-16", "2026-03-17", "2026-03-18", "2026-03-23", "2026-03-24", "2026-03-25", "2026-03-26", "2026-03-27", "2026-03-28", "2026-03-31",
        "2026-04-01", "2026-04-02", "2026-04-06", "2026-04-07", "2026-04-08", "2026-04-09", "2026-04-10", "2026-04-11",
        "2026-05-02", "2026-05-05", "2026-05-06", "2026-05-07", "2026-05-08", "2026-05-09", "2026-05-12", "2026-05-13", "2026-05-14", "2026-05-15", "2026-05-16", "2026-05-19", "2026-05-20", "2026-05-21", "2026-05-23", "2026-05-26", "2026-05-27", "2026-05-28", "2026-05-29", "2026-05-30",
        "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05", "2026-06-06", "2026-06-09", "2026-06-10", "2026-06-11", "2026-06-12", "2026-06-13", "2026-06-16", "2026-06-17", "2026-06-18", "2026-06-19", "2026-06-20", "2026-06-24", "2026-06-27", "2026-06-30"
      ];

      const attendanceSeeds: Record<string, string> = {
        "Sai krishna k m": "111111110111111N10101010011111110111110111111110111111111111011011111111N11N10111101N1111111111111111111111111111111111111110",
        "Shashwath K S": "111111111111111N11111111111111011111111111011111111110111111111111011111N11N11111011N1111111011111111011110011111110100100001111",
        "Sewana M": "111111111111111N11111111111111110111111110011111111111111111110111111111N11N11111111N0111115111110151111111101111111011111111111",
        "Ambika Yallal": "111111110111111N11111111101011111111110111111110011111111111111111111111N11N11111111N111111000011111111111111111111011111111111111",
        "Aishwarya L Pujeri": "111111111111111N11111111111011111111111111111100111111111111111111111111N11N11111111N111111110111111111101111111111011111111111111",
        "Alina Shibu": "111111110111111N11111111111111110111111111111111111101111111111111011111N11N11111111N0111111111111511111111011111111111111101111",
        "Bhagyashree C Patil": "111111110110111N11111111101111110111111111111111111101111111011101010111N11N11111111N0111010101111101111110101011111111111111111",
        "Chalukya Nayaka B K": "111111111111111N11111111111111101111101111111111011111111111011111101111N11N11111111N1111111111100111111110111111111111111111111",
        "Shilpa J": "111111111111111N11111111111011101111111011501111111111011111111011011101N11N11111111N1111111000111000111110111101111111111111111",
        "Janhvi Jeevan Revankar": "111111111111111N11111111101111111111111111111111111111111110111111110111N11N11010111N1111115111111111111111111111111111111111111",
        "Kondamadugula venkateshwara reddy": "111000010001000N000000000NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
        "Sreediya S": "111111111111111N11111111111011111111111111111111110111111101111111111111N11N11111111N01111110111011111111111111111111111511111",
        "Nithya T M": "111111111111111N11111111101111110011111111111111111111111111111111101111N11N11111111N0111111011151111111110111011111111111111111",
        "Lakshmi Shivani K": "110111110111111N11111111101111015011111111111151111111101111111511001111N11N11111111N1111111011111111111100111011110111111111111",
        "Jothika B": "111101111111000N00000000010000100001010000100101000111000110011010101001N00N01010000N1000111111111111111111111111111111111111111",
        "Sneha S": "000000100011111N11111111101111111111110111111111111111111111111011111111N11N01011101N111111011115110111111011111111111011111111",
        "B Meenu": "111111110111111N11111111111111111111110111111111111111111111111111011111N11N11111111N111111115111111111111111111111101111111111",
        "Kaarthikeyen G": "111111111111111N11111111111111111101101111111111111100511110100111111111N11N11111111N1111111111111111111111100111111111111111111",
        "Shaan Abraham": "111111111111111N11111111111111111111011011111111111111111111111111111111N11N11111111N0111111115111111111111111111111111111111111",
        "Mevada Vinit": "111111111111111N11111111111111111111110011111111111110111101001011111111N11N11111111N111111111111111111111111111111111111111111",
        "Dhanusha G": "100001111111111N11111111111011101111111111111111111101111110111011111111N11N11111101N111111111111111111111011111111111111111111",
        "Dattaguru Chettiar": "111111111111111N11111111101111111111111111111111111111111111111110111111N11N11111111N111111111111111111111111111111111111111111",
        "Avish T S": "101011111111111N11111111101111111111110111111111110111111111011111101111N11N11111111N11111101111111110111111110111010111101101111011",
        "Veda Shivayogi Ramagondanahalli": "NNNNNNNNN111111N11111111101111111111110011111111111111111111111111110111N11N11111111N1111111100111101111111111111111111111111111",
        "Rajendra Rathod": "NNNNNNNNNNNN111N11111111101111111011110510011111111101111111110110101110N11N11111111N011111501115101151111010110110000111111101110000111111",
        "Ayesha": "NNNNNNNNNNNNNNNNNNNNNNNNN10010011100111111111115111111111101111011011111N11N01011101N11111151111110010111100011101111111111111011111111111"
      };

      // Map name -> id for student records we just inserted
      const studentMap: Record<string, string> = {};
      const allStudentsRes = await db.execute("SELECT id, name FROM students WHERE class_id = '" + classId + "'");
      for (const row of allStudentsRes.rows) {
        studentMap[(row.name as string).toLowerCase()] = row.id as string;
      }

      for (const [studentName, seedStr] of Object.entries(attendanceSeeds)) {
        const studentId = studentMap[studentName.toLowerCase()];
        if (!studentId) continue;

        for (let i = 0; i < classDates.length; i++) {
          const char = seedStr[i];
          if (char === "N") continue;
          const status = char === "1" ? 1 : char === "0" ? 0 : 0.5;
          await db.execute({
            sql: "INSERT INTO attendance (id, student_id, date, status, created_at) VALUES (?, ?, ?, ?, ?)",
            args: [crypto.randomUUID(), studentId, classDates[i], status, now]
          });
        }
      }

      console.log("[SQLite Server] Seeding attendance and holidays complete.");
      console.log("[SQLite Server] Default seed complete.");
    }
  } catch (err) {
    console.error("[SQLite Server] Initialization error:", err);
  }
}

// DB initialization is now triggered lazily on the first query

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// Helper to get session by token
async function getSessionUser(token?: string) {
  if (!token) return null;
  try {
    const sRes = await db.execute({
      sql: "SELECT * FROM sessions WHERE id = ?",
      args: [token],
    });
    if (sRes.rows.length === 0) return null;
    const session = sRes.rows[0];
    const uRes = await db.execute({
      sql: "SELECT * FROM auth_users WHERE id = ?",
      args: [session.user_id as string],
    });
    if (uRes.rows.length === 0) return null;
    return {
      id: uRes.rows[0].id as string,
      email: uRes.rows[0].email as string,
    };
  } catch {
    return null;
  }
}

export async function handleAuthAction(payload: any = {}) {
  const { action, email, password, fullName, role, token } = payload || {};
  const cleanEmail = email?.trim().toLowerCase();

  try {
    if (action === "signUp") {
      const uId = crypto.randomUUID();
      const pwHash = hashPassword(password);
      const now = new Date().toISOString();

      // 1. Create auth user
      await db.execute({
        sql: "INSERT INTO auth_users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
        args: [uId, cleanEmail, pwHash, now],
      });

      // 2. Create profile
      await db.execute({
        sql: "INSERT INTO profiles (id, full_name, email, created_at) VALUES (?, ?, ?, ?)",
        args: [uId, fullName || "", cleanEmail, now],
      });

      // 3. Create role
      const cleanRole = role || "student";
      await db.execute({
        sql: "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)",
        args: [crypto.randomUUID(), uId, cleanRole],
      });

      // 4. If student, link existing student records by email (like the Postgres trigger)
      if (cleanRole === "student") {
        await db.execute({
          sql: "UPDATE students SET user_id = ? WHERE user_id IS NULL AND lower(email) = lower(?)",
          args: [uId, cleanEmail],
        });
      }

      // Generate session
      const sessionToken = crypto.randomUUID();
      await db.execute({
        sql: "INSERT INTO sessions (id, user_id, email, created_at) VALUES (?, ?, ?, ?)",
        args: [sessionToken, uId, cleanEmail, now],
      });

      return {
        session: {
          access_token: sessionToken,
          user: { id: uId, email: cleanEmail },
        },
        error: null,
      };
    }

    if (action === "signIn") {
      const pwHash = hashPassword(password);
      const res = await db.execute({
        sql: "SELECT * FROM auth_users WHERE lower(email) = lower(?) AND password_hash = ?",
        args: [cleanEmail, pwHash],
      });

      if (res.rows.length === 0) {
        return { session: null, error: { message: "Invalid login credentials" } };
      }

      const user = res.rows[0];
      const sessionToken = crypto.randomUUID();
      await db.execute({
        sql: "INSERT INTO sessions (id, user_id, email, created_at) VALUES (?, ?, ?, ?)",
        args: [sessionToken, user.id as string, user.email as string, new Date().toISOString()],
      });

      return {
        session: {
          access_token: sessionToken,
          user: { id: user.id, email: user.email },
        },
        error: null,
      };
    }

    if (action === "signOut") {
      if (token) {
        await db.execute({
          sql: "DELETE FROM sessions WHERE id = ?",
          args: [token],
        });
      }
      return { error: null };
    }

    if (action === "getUser") {
      const user = await getSessionUser(token);
      if (!user) return { user: null, error: { message: "Session expired or invalid" } };
      return { user, error: null };
    }

    if (action === "updateUser") {
      const user = await getSessionUser(token);
      if (!user) return { error: { message: "Unauthorized" } };
      const newHash = hashPassword(password);
      await db.execute({
        sql: "UPDATE auth_users SET password_hash = ? WHERE id = ?",
        args: [newHash, user.id],
      });
      return { error: null };
    }

    return { error: { message: "Unknown auth action" } };
  } catch (e: any) {
    console.error("[SQLite Auth Error]", e);
    return { session: null, error: { message: e.message || "Authentication error" } };
  }
}

export async function handleDbQuery(query: any = {}) {
  const { action, table, select, filters, orderCol, orderAscending, data, single, maybeSingle, token } = query || {};

  try {
    const user = await getSessionUser(token);

    if (action === "select") {
      // Special case: students table joins classes table
      if (table === "students" && select && select.includes("classes")) {
        let sql = `
          SELECT s.*,
                 c.id AS classes_id,
                 c.name AS classes_name,
                 c.section AS classes_section,
                 c.subject AS classes_subject,
                 c.teacher_id AS classes_teacher_id
          FROM students s
          LEFT JOIN classes c ON s.class_id = c.id
        `;
        const sqlArgs: any[] = [];
        const whereParts: string[] = [];

        if (filters) {
          for (const f of filters) {
            const prefix = f.col === "id" || f.col === "user_id" || f.col === "class_id" ? "s." : "";
            if (f.type === "eq") {
              whereParts.push(`${prefix}${f.col} = ?`);
              sqlArgs.push(f.val);
            } else if (f.type === "ilike") {
              whereParts.push(`lower(${prefix}${f.col}) = lower(?)`);
              sqlArgs.push(f.val);
            } else if (f.type === "is" && f.val === null) {
              whereParts.push(`${prefix}${f.col} IS NULL`);
            } else if (f.type === "in") {
              whereParts.push(`${prefix}${f.col} IN (${f.val.map(() => "?").join(",")})`);
              sqlArgs.push(...f.val);
            }
          }
        }

        if (whereParts.length > 0) {
          sql += ` WHERE ${whereParts.join(" AND ")}`;
        }

        if (orderCol) {
          const prefix = orderCol === "name" ? "s." : "";
          sql += ` ORDER BY ${prefix}${orderCol} ${orderAscending !== false ? "ASC" : "DESC"}`;
        }

        const res = await db.execute({ sql, args: sqlArgs });
        const rows = res.rows.map((r: any) => ({
          id: r.id,
          class_id: r.class_id,
          user_id: r.user_id,
          name: r.name,
          email: r.email,
          gender: r.gender,
          quota: r.quota,
          stream: r.stream,
          official_email: r.official_email,
          mobile_number: r.mobile_number,
          pgcet_num: r.pgcet_num,
          joining_date: r.joining_date,
          created_at: r.created_at,
          classes: r.classes_id ? {
            id: r.classes_id,
            name: r.classes_name,
            section: r.classes_section,
            subject: r.classes_subject,
            teacher_id: r.classes_teacher_id,
          } : null,
        }));

        if (single || maybeSingle) {
          return { data: rows[0] || null, error: null };
        }
        return { data: rows, error: null };
      }

      // Special case: leave_requests joins students and classes
      if (table === "leave_requests" && select && select.includes("students")) {
        let sql = `
          SELECT lr.*,
                 s.id AS student_id,
                 s.name AS student_name,
                 s.email AS student_email,
                 s.class_id AS student_class_id,
                 c.name AS class_name
          FROM leave_requests lr
          LEFT JOIN students s ON lr.student_id = s.id
          LEFT JOIN classes c ON s.class_id = c.id
        `;
        const sqlArgs: any[] = [];
        const whereParts: string[] = [];

        if (filters) {
          for (const f of filters) {
            const prefix = f.col === "student_id" ? "lr." : "";
            if (f.type === "eq") {
              whereParts.push(`${prefix}${f.col} = ?`);
              sqlArgs.push(f.val);
            }
          }
        }

        // Teacher access rule: only retrieve leave requests for students in classes taught by this teacher
        if (user) {
          const roleRes = await db.execute({
            sql: "SELECT role FROM user_roles WHERE user_id = ?",
            args: [user.id],
          });
          const role = roleRes.rows[0]?.role;
          if (role === "teacher") {
            whereParts.push(`c.teacher_id = ?`);
            sqlArgs.push(user.id);
          }
        }

        if (whereParts.length > 0) {
          sql += ` WHERE ${whereParts.join(" AND ")}`;
        }

        if (orderCol) {
          sql += ` ORDER BY lr.${orderCol} ${orderAscending !== false ? "ASC" : "DESC"}`;
        }

        const res = await db.execute({ sql, args: sqlArgs });
        const rows = res.rows.map((r: any) => ({
          id: r.id,
          leave_date: r.leave_date,
          reason: r.reason,
          status: r.status,
          teacher_note: r.teacher_note,
          created_at: r.created_at,
          updated_at: r.updated_at,
          student_id: r.student_id,
          students: r.student_id ? {
            id: r.student_id,
            name: r.student_name,
            email: r.student_email,
            class_id: r.student_class_id,
            classes: r.class_name ? { name: r.class_name } : null,
          } : null,
        }));

        if (single || maybeSingle) {
          return { data: rows[0] || null, error: null };
        }
        return { data: rows, error: null };
      }

      // Generic SELECT
      let sql = `SELECT * FROM ${table}`;
      const sqlArgs: any[] = [];
      const whereParts: string[] = [];

      if (filters) {
        for (const f of filters) {
          if (f.type === "eq") {
            whereParts.push(`${f.col} = ?`);
            sqlArgs.push(f.val);
          } else if (f.type === "gte") {
            whereParts.push(`${f.col} >= ?`);
            sqlArgs.push(f.val);
          } else if (f.type === "lte") {
            whereParts.push(`${f.col} <= ?`);
            sqlArgs.push(f.val);
          } else if (f.type === "ilike") {
            whereParts.push(`lower(${f.col}) = lower(?)`);
            sqlArgs.push(f.val);
          } else if (f.type === "is" && f.val === null) {
            whereParts.push(`${f.col} IS NULL`);
          } else if (f.type === "in") {
            if (f.val && f.val.length > 0) {
              whereParts.push(`${f.col} IN (${f.val.map(() => "?").join(",")})`);
              sqlArgs.push(...f.val);
            } else {
              whereParts.push("1 = 0");
            }
          }
        }
      }

      // Special rule for student reading holidays: filter holidays of teacher of their class
      if (table === "holidays" && user) {
        const roleRes = await db.execute({
          sql: "SELECT role FROM user_roles WHERE user_id = ?",
          args: [user.id],
        });
        const role = roleRes.rows[0]?.role;
        if (role === "student") {
          const teacherRes = await db.execute({
            sql: `
              SELECT c.teacher_id FROM students s
              JOIN classes c ON s.class_id = c.id
              WHERE s.user_id = ?
            `,
            args: [user.id],
          });
          const tIds = teacherRes.rows.map(r => r.teacher_id as string);
          if (tIds.length > 0) {
            whereParts.push(`teacher_id IN (${tIds.map(() => "?").join(",")})`);
            sqlArgs.push(...tIds);
          } else {
            whereParts.push("1 = 0");
          }
        }
      }

      if (whereParts.length > 0) {
        sql += ` WHERE ${whereParts.join(" AND ")}`;
      }

      if (orderCol) {
        sql += ` ORDER BY ${orderCol} ${orderAscending !== false ? "ASC" : "DESC"}`;
      }

      const res = await db.execute({ sql, args: sqlArgs });
      const rows = res.rows;

      if (single || maybeSingle) {
        return { data: rows[0] || null, error: null };
      }
      return { data: rows, error: null };
    }

    if (action === "insert") {
      const id = data.id || crypto.randomUUID();
      const now = new Date().toISOString();
      const record = {
        id,
        created_at: now,
        ...data,
      };

      if (table === "leave_requests") {
        (record as any).updated_at = now;
      }

      delete (record as any).updated_at_column;

      const cols = Object.keys(record);
      const vals = Object.values(record);
      const sql = `INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`;

      await db.execute({ sql, args: vals });
      return { data: record, error: null };
    }

    if (action === "update") {
      const cols = Object.keys(data);
      const vals = Object.values(data);
      let sql = `UPDATE ${table} SET ${cols.map(c => `${c} = ?`).join(",")}`;
      const sqlArgs = [...vals];
      const whereParts: string[] = [];

      if (filters) {
        for (const f of filters) {
          if (f.type === "eq") {
            whereParts.push(`${f.col} = ?`);
            sqlArgs.push(f.val);
          }
        }
      }

      if (whereParts.length > 0) {
        sql += ` WHERE ${whereParts.join(" AND ")}`;
      } else {
        return { error: { message: "Update without filters not allowed" } };
      }

      await db.execute({ sql, args: sqlArgs });
      return { data, error: null };
    }

    if (action === "delete") {
      let sql = `DELETE FROM ${table}`;
      const sqlArgs: any[] = [];
      const whereParts: string[] = [];

      if (filters) {
        for (const f of filters) {
          if (f.type === "eq") {
            whereParts.push(`${f.col} = ?`);
            sqlArgs.push(f.val);
          }
        }
      }

      if (whereParts.length > 0) {
        sql += ` WHERE ${whereParts.join(" AND ")}`;
      } else {
        return { error: { message: "Delete without filters not allowed" } };
      }

      await db.execute({ sql, args: sqlArgs });
      return { error: null };
    }

    if (action === "upsert") {
      const rows = Array.isArray(data) ? data : [data];
      const now = new Date().toISOString();

      for (const row of rows) {
        const record = {
          id: row.id || crypto.randomUUID(),
          created_at: now,
          ...row,
        };

        const cols = Object.keys(record);
        const vals = Object.values(record);

        let sql = `INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`;

        if (table === "attendance") {
          sql += ` ON CONFLICT(student_id, date) DO UPDATE SET status = excluded.status, created_at = excluded.created_at`;
        } else if (table === "leave_requests") {
          sql += ` ON CONFLICT(student_id, leave_date) DO UPDATE SET reason = excluded.reason, status = excluded.status, updated_at = excluded.updated_at`;
        } else {
          sql += ` ON CONFLICT(id) DO UPDATE SET ${cols.map(c => `${c} = excluded.${c}`).join(",")}`;
        }

        await db.execute({ sql, args: vals });
      }

      return { data, error: null };
    }

    return { error: { message: `Unknown DB action: ${action}` } };
  } catch (e: any) {
    console.error("[SQLite DB Error]", e);
    return { data: null, error: { message: e.message || "Database execution error", code: e.code } };
  }
}
