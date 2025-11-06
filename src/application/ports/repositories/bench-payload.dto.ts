import { Duration } from '@js-joda/core';

export function durationToPgInterval(d: Duration): string {
  const seconds = d.seconds();
  const nanos = d.nano();
  let totalNanos = BigInt(seconds) * 1_000_000_000n + BigInt(nanos);

  const negative = totalNanos < 0n;
  if (negative) totalNanos = -totalNanos;

  const NS_PER_DAY = 86_400_000_000_000n;
  const NS_PER_HOUR = 3_600_000_000_000n;
  const NS_PER_MIN = 60_000_000_000n;
  const NS_PER_SEC = 1_000_000_000n;

  const days = totalNanos / NS_PER_DAY;
  let rem = totalNanos % NS_PER_DAY;

  const hours = rem / NS_PER_HOUR;
  rem %= NS_PER_HOUR;

  const minutes = rem / NS_PER_MIN;
  rem %= NS_PER_MIN;

  const secondsInt = rem / NS_PER_SEC;
  const nanosRem = rem % NS_PER_SEC;

  let micros = Number((nanosRem + 500n) / 1_000n); // arrondi à la microseconde
  let sec = Number(secondsInt);
  let min = Number(minutes);
  let hr = Number(hours);
  let day = Number(days);

  if (micros >= 1_000_000) {
    micros -= 1_000_000;
    sec += 1;
  }
  if (sec >= 60) {
    sec -= 60;
    min += 1;
  }
  if (min >= 60) {
    min -= 60;
    hr += 1;
  }
  if (hr >= 24) {
    hr -= 24;
    day += 1;
  }

  const parts: string[] = [];
  if (day !== 0) parts.push(`${day} days`);

  const hh = String(hr).padStart(2, '0');
  const mm = String(min).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');

  let time = `${hh}:${mm}:${ss}`;
  if (micros > 0) {
    time += `.${String(micros).padStart(6, '0')}`;
  }

  parts.push(time);

  const body = parts.join(' ');
  return negative ? `-${body}` : body;
}

export type BenchPayloadDto = {
  contractId: string;
  cleanerId: string;
  type: 'Absence' | 'Intercontrat';
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  duration: string;
  accountId: string;
  accountName: string;
  silaeId: string;
  days: Partial<{
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  }>;
  totalDuration: number;
  punctualReason: string | null;
  prestationType: string | null;
  catalogItemId: string | null;
};
