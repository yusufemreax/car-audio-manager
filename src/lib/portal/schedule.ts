export const INSTALLATION_MINUTES = 210;
export const BOOKING_DAYS = 60;
const DAY_MS = 86400000;
const OFFSET_MS = 3 * 3600000; // Europe/Istanbul (UTC+03)
export function istanbulDate(now: Date) {
  return new Date(now.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}
export function addDays(date: string, count: number) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + count * DAY_MS)
    .toISOString()
    .slice(0, 10);
}
export function weekday(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}
export function shippingAvailability(now: Date) {
  const local = new Date(now.getTime() + OFFSET_MS);
  const today = istanbulDate(now);
  const afterCutoff =
    local.getUTCHours() * 3600000 +
      local.getUTCMinutes() * 60000 +
      local.getUTCSeconds() * 1000 +
      local.getUTCMilliseconds() >
    15 * 3600000;
  let dispatch =
    afterCutoff || weekday(today) === 0 ? addDays(today, 1) : today;
  while (weekday(dispatch) === 0) dispatch = addDays(dispatch, 1);
  let arrival = addDays(dispatch, 1);
  while (weekday(arrival) === 0) arrival = addDays(arrival, 1);
  return {
    earliestDate: arrival,
    warning:
      weekday(today) === 5 || weekday(dispatch) === 5
        ? "Cuma günü verilen siparişlerde kargo durumuna göre aksama yaşanabilir. Olası bir durumda sizinle iletişime geçilecektir."
        : null,
  };
}
export function dailyStarts(date: string) {
  const day = weekday(date);
  const from = day === 0 || day === 6 ? 11 * 60 : 18 * 60 + 30;
  const result: Date[] = [];
  for (let minutes = from; minutes <= 22 * 60; minutes += 30) {
    const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    result.push(new Date(`${date}T${time}:00+03:00`));
  }
  return result;
}
export function isEligibleStart(start: Date, now: Date) {
  if (!Number.isFinite(start.getTime()) || start <= now) return false;
  const date = istanbulDate(start);
  const earliest = shippingAvailability(now).earliestDate;
  if (date < earliest || date >= addDays(earliest, BOOKING_DAYS)) return false;
  return dailyStarts(date).some(
    (candidate) => candidate.getTime() === start.getTime(),
  );
}
export function conflicts(start: Date, other: Date) {
  return (
    Math.abs(start.getTime() - other.getTime()) < INSTALLATION_MINUTES * 60000
  );
}
export function lockKeys(start: Date) {
  return Array.from({ length: INSTALLATION_MINUTES / 30 }, (_, i) =>
    String(start.getTime() + i * 30 * 60000),
  );
}
export function makeAvailability(now: Date, occupied: Date[]) {
  const shipping = shippingAvailability(now);
  return {
    ...shipping,
    days: Array.from({ length: BOOKING_DAYS }, (_, i) => {
      const date = addDays(shipping.earliestDate, i);
      return {
        date,
        slots: dailyStarts(date)
          .filter(
            (start) =>
              start > now && !occupied.some((other) => conflicts(start, other)),
          )
          .map((start) => start.toISOString()),
      };
    }),
  };
}
