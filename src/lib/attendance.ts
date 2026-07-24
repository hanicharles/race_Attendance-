export type DayType = "W" | "H"; // Working or Holiday (incl. Sunday)

export function monthDays(year: number, month: number, holidayDates: Set<string>, today = new Date()): { date: string; type: DayType }[] {
  const numDays = new Date(year, month, 0).getDate(); // month is 1-12
  const out: { date: string; type: DayType }[] = [];
  for (let day = 1; day <= numDays; day++) {
    const d = new Date(year, month - 1, day);
    if (d > today) break;
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isSunday = d.getDay() === 0;
    out.push({ date: iso, type: isSunday || holidayDates.has(iso) ? "H" : "W" });
  }
  return out;
}

export function rangeDays(startDateStr: string, endDateStr: string, holidayDates: Set<string>, today = new Date()): { date: string; type: DayType }[] {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];

  const out: { date: string; type: DayType }[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    if (cur > today) break;
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    const iso = `${y}-${m}-${d}`;
    const isSunday = cur.getDay() === 0;
    out.push({ date: iso, type: isSunday || holidayDates.has(iso) ? "H" : "W" });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];