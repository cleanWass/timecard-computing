import { DayOfWeek, Duration, LocalDate, TemporalAdjusters } from '@js-joda/core';
import { List } from 'immutable';

export const getFirstDayOfWeek = (date: LocalDate) => date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

export const formatDuration = (d: Duration) => `${d.toHours()}h${d?.toMinutes() % 60 > 0 ? `${d.toMinutes() % 60} ` : ''}`;

export const formatDurationAs100 = (d: Duration) =>
  `${d.toHours()}${d?.toMinutes() % 60 > 0 ? `,${(((d.toMinutes() % 60) / 60) * 100).toFixed(0)}` : ''}`;

export const getGreaterDuration = (d1: Duration, d2: Duration) => (d1.compareTo(d2) > 0 ? d1 : d2);

export const getLowerDuration = (d1: Duration, d2: Duration) => (d1.compareTo(d2) > 0 ? d2 : d1);

type WithDuration<T> = T & { duration: Duration };

export const getTotalDuration = <T>(entities: List<WithDuration<T>>) =>
  entities.reduce((acc, entity) => acc.plus(entity.duration), Duration.ZERO);
