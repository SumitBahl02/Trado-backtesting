import moment from "moment-timezone";

const TIMEZONE = "Asia/Kolkata";


/** Get Time out of timestamp
 * @param time the timestamp from which time need to extract
 */
export function getTime(timestamp: string): string {
  const time = moment.parseZone(timestamp).format("HH:mm:ss");
  return time;
}


/**
 * Format a Date object to YYYY-MM-DD string
 * @param date The date to format
 */
export function formatDate(date: Date): string {
  // TODO: Implement date formatting functionality
  return moment(date).tz(TIMEZONE).format();
}

/**
 * Convert time string to Date object
 * @param dateStr Date string in YYYY-MM-DD format
 * @param timeStr Time string in HH:MM format
 */
export function createDateTime(dateStr: string, timeStr: string): Date {
  const dateTimeStr = `${dateStr} ${timeStr}`;
  const m = moment.tz(dateTimeStr, "YYYY-MM-DD HH:mm", TIMEZONE);

  return m.toDate(); // returns a JS Date object in UTC
}

/**
 * Check if a time is within a specific range in the given time zone
 * @param time The time to check (HH:MM format)
 * @param startTime Range start time (HH:MM format)
 * @param endTime Range end time (HH:MM format)
 */
export function isTimeInRange(
  time: string,
  startTime: string,
  endTime: string
): boolean {
  const today = moment.tz(TIMEZONE).format("YYYY-MM-DD");
  const mTime = moment.tz(`${today} ${time}`, "YYYY-MM-DD HH:mm", TIMEZONE);
  const mStart = moment.tz(
    `${today} ${startTime}`,
    "YYYY-MM-DD HH:mm",
    TIMEZONE
  );
  const mEnd = moment.tz(`${today} ${endTime}`, "YYYY-MM-DD HH:mm", TIMEZONE);

  if (mEnd.isBefore(mStart)) {
    return mTime.isSameOrAfter(mStart) || mTime.isBefore(mEnd);
  } else {
    return mTime.isBetween(mStart, mEnd, undefined, "[]");
  }
}

/**
 * Get the last N trading days (Monday to Friday) based on a given time zone
 * @param n Number of trading days to retrieve
 */
export async function getLastNTradingDays(n: number): Promise<string[]> {
  const result: string[] = [];
  let m = moment.tz(TIMEZONE);

  while (result.length < n) {
    const day = m.day(); // 0 = Sunday, 6 = Saturday
    if (day >= 1 && day <= 5) {
      result.push(m.format("YYYY-MM-DD"));
    }
    m = m.subtract(1, "day");
  }

  return result;
}