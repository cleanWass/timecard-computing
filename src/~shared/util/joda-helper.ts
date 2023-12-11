import { DayOfWeek, Duration, LocalDate, TemporalAdjusters } from '@js-joda/core';

export const getFirstDayOfWeek = (date: LocalDate) => date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

export const formatDuration = (d: Duration) => `${d.toHours()}h${d?.toMinutes() % 60 > 0 ? `${d.toMinutes() % 60} ` : ''}`;

export const getGreaterDuration = (d1: Duration, d2: Duration) => (d1.compareTo(d2) > 0 ? d1 : d2);
