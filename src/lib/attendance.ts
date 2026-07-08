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

export const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];