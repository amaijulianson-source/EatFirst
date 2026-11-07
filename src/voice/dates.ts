import { validDate } from "../core";
export type SpokenDate = {
  date: string;
  type?: "use-by" | "best-before";
  reason: string;
};
const numbers: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  nul: 0,
  een: 1,
  twee: 2,
  drie: 3,
  vier: 4,
  vijf: 5,
  zes: 6,
  zeven: 7,
  acht: 8,
  negen: 9,
  tien: 10,
  elf: 11,
  twaalf: 12,
  dertien: 13,
  veertien: 14,
  vijftien: 15,
  zestien: 16,
  zeventien: 17,
  achttien: 18,
  negentien: 19,
  twintig: 20,
  dertig: 30,
  veertig: 40,
  vijftig: 50,
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  thirtieth: 30,
  eerste: 1,
  tweede: 2,
  derde: 3,
  vierde: 4,
  vijfde: 5,
  zesde: 6,
  zevende: 7,
  achtste: 8,
  negende: 9,
  tiende: 10,
  elfde: 11,
  twaalfde: 12,
  dertiende: 13,
  veertiende: 14,
  vijftiende: 15,
  zestiende: 16,
  zeventiende: 17,
  achttiende: 18,
  negentiende: 19,
  twintigste: 20,
  dertigste: 30,
};
export function numberWords(text: string) {
  let s = text.normalize("NFKC").toLowerCase().replace(/[’‘]/g, "'");
  // Dutch compound numbers are a single word, including optional diacritics.
  s = s.replace(
    /\b(een|twee|drie|vier|vijf|zes|zeven|acht|negen)[eë]n(twintig|dertig|veertig|vijftig)(?:ste)?\b/g,
    (_, a, b) => String(numbers[a] + numbers[b]),
  );
  s = s.replace(
    /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[ -](one|two|three|four|five|six|seven|eight|nine|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth)\b/g,
    (_, a, b) => String(numbers[a] + numbers[b]),
  );
  return s
    .replace(/\b[a-z]+\b/g, (w, offset) =>
      w === "ten" && /^\s+minste\b/.test(s.slice(offset + w.length))
        ? w
        : numbers[w] === undefined
          ? w
          : String(numbers[w]),
    )
    .replace(/\b(\d+)(?:st|nd|rd|th|ste|de)\b/g, "$1")
    .replace(/\b(\d+) and a half\b/g, (_, n) => String(Number(n) + 0.5))
    .replace(/\banderhalf\b/g, "1.5");
}
const months: Record<string, number> = {
  january: 1,
  januari: 1,
  february: 2,
  februari: 2,
  march: 3,
  maart: 3,
  april: 4,
  may: 5,
  mei: 5,
  june: 6,
  juni: 6,
  july: 7,
  juli: 7,
  august: 8,
  augustus: 8,
  september: 9,
  october: 10,
  oktober: 10,
  november: 11,
  december: 12,
};
const weekdays: Record<string, number> = {
  sunday: 0,
  zondag: 0,
  monday: 1,
  maandag: 1,
  tuesday: 2,
  dinsdag: 2,
  wednesday: 3,
  woensdag: 3,
  thursday: 4,
  donderdag: 4,
  friday: 5,
  vrijdag: 5,
  saturday: 6,
  zaterdag: 6,
};
export function calendarToday(
  now = new Date(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k)!.value)
    .join("-");
}
export function plusDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function spokenDate(raw: string, today: string): SpokenDate | null {
  const s = numberWords(raw);
  const type = /\b(?:use[ -]?by|te gebruiken tot|tgt)\b/.test(s)
    ? "use-by"
    : /\b(?:best[ -]?before|ten minste houdbaar|tht)\b/.test(s)
      ? "best-before"
      : undefined;
  const trigger =
    /\b(?:good until|good for|expires?|expiry|expir(?:es|ing)|best[ -]?before|use[ -]?by|until|houdbaar|goed tot|goed voor|tot|vervalt|verlopen|tht|tgt|another \d+ days|nog \d+ dagen)\b/;
  if (!trigger.test(s)) return null;
  let date = "",
    reason = "Confirm this date against the package.";
  if (/\b(?:day after tomorrow|overmorgen)\b/.test(s))
    date = plusDays(today, 2);
  else if (/\b(?:tomorrow|morgen)\b/.test(s)) date = plusDays(today, 1);
  else if (/\b(?:today|vandaag)\b/.test(s)) date = today;
  else if (/\b(?:yesterday|gisteren)\b/.test(s)) date = plusDays(today, -1);
  else {
    const relative = s.match(
      /\b(?:another|in|for|over|nog|voor)\s+(\d+)\s*(days?|dagen|weeks?|weken)\b/,
    );
    if (relative)
      date = plusDays(
        today,
        Number(relative[1]) * (/week|weken/.test(relative[2]) ? 7 : 1),
      );
    const weekday = Object.keys(weekdays).find((w) =>
      new RegExp(`\\b${w}\\b`).test(s),
    );
    if (!date && weekday) {
      const day = new Date(`${today}T12:00:00Z`).getUTCDay();
      let delta = (weekdays[weekday] - day + 7) % 7;
      if (!delta) delta = 7;
      date = plusDays(today, delta);
      reason =
        "Weekday interpreted as the next occurrence. Confirm the calendar date.";
    }
    if (!date) {
      const iso = s.match(/\b(\d{4}-\d{2}-\d{2})\b/);
      if (iso) date = iso[1];
      else {
        const month = Object.keys(months).find((m) =>
          new RegExp(`\\b${m}\\b`).test(s),
        );
        if (month) {
          const match = s.match(
            new RegExp(
              `(?:${month}\\s+(?:the\\s+)?(\\d{1,2})|(\\d{1,2})\\s+(?:of\\s+)?${month})(?:\\s+(\\d{4}))?`,
            ),
          );
          if (match) {
            const year = match[3] ?? today.slice(0, 4);
            date = `${year}-${String(months[month]).padStart(2, "0")}-${String(match[1] ?? match[2]).padStart(2, "0")}`;
            if (!match[3])
              reason =
                "No year spoken; using the current year. Confirm the date.";
          }
        } else {
          const numeric = s.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{4}))?\b/);
          if (numeric) {
            date = `${numeric[3] ?? today.slice(0, 4)}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}`;
            reason =
              "Numeric date interpreted as day/month. Confirm the full date.";
          } else {
            const day = s.match(
              /\b(?:by|until|on|tot|de|the)\s+(?:the\s+)?(\d{1,2})\b/,
            );
            if (day) {
              date = `${today.slice(0, 7)}-${day[1].padStart(2, "0")}`;
              reason =
                "No month/year spoken; using the current month. Confirm the date.";
            }
          }
        }
      }
    }
  }
  if (!date || !validDate(date))
    return {
      date: "",
      type,
      reason: "Could not resolve the spoken date. Enter it manually.",
    };
  if (date < today) reason += " This date is in the past.";
  if (!type)
    reason += " Date type was not specified; check use-by or best-before.";
  return { date, type, reason };
}
