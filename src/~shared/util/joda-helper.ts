import {
  DateTimeFormatter,
  DayOfWeek,
  Duration,
  LocalDate,
  TemporalAdjusters,
} from '@js-joda/core';
import { List } from 'immutable';

export const getFirstDayOfWeek = (date: LocalDate) =>
  date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

export const formatDuration = (d: Duration) =>
  `${d.toHours()}h${d?.toMinutes() % 60 > 0 ? `${d.toMinutes() % 60} ` : ''}`;

export const formatDurationAs100 = (d: Duration, nullCharacter = '0') =>
  d === Duration.ZERO
    ? nullCharacter
    : `${d.toHours()}${
        d?.toMinutes() % 60 > 0
          ? `,${(((d.toMinutes() % 60) / 60) * 100).toFixed(0).padStart(2, '0')}`
          : ''
      }`;

export const getGreaterDuration = (d1: Duration, d2: Duration) => (d1.compareTo(d2) > 0 ? d1 : d2);

export const getLowerDuration = (d1: Duration, d2: Duration) => (d1.compareTo(d2) > 0 ? d2 : d1);

type WithDuration<T> = T & { duration: Duration };

export const getTotalDuration = <T>(entities: List<WithDuration<T>>) =>
  entities.reduce((acc, entity) => acc.plus(entity.duration), Duration.ZERO);

export const formatLocalDate = ({ date, pattern }: { date: LocalDate; pattern?: string }) =>
  date.format(DateTimeFormatter.ofPattern(pattern || 'dd/MM/yy'));

export const parseLocalDate = ({ date, pattern }: { date: string; pattern?: string }) =>
  LocalDate.parse(date, DateTimeFormatter.ofPattern(pattern || 'dd/MM/yy'));

export const toHoursFloat = (duration: Duration): number =>
  duration.seconds() / 3600 + duration.nano() / 3.6e12;
