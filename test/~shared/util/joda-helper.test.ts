import { DayOfWeek, Duration, LocalDate } from '@js-joda/core';
import { List } from 'immutable';
import {
  getFirstDayOfWeek,
  formatDuration,
  formatDurationAs100,
  getGreaterDuration,
  getLowerDuration,
  getTotalDuration,
} from '../../../src/~shared/util/joda-helper';

describe('joda-helper', () => {
  describe('getFirstDayOfWeek', () => {
    it('returns the same date when the date is already a Monday', () => {
      // Monday, January 3, 2022
      const monday = LocalDate.of(2022, 1, 3);
      expect(getFirstDayOfWeek(monday).equals(monday)).toBe(true);
    });

    it('returns the previous Monday when the date is not a Monday', () => {
      // Wednesday, January 5, 2022
      const wednesday = LocalDate.of(2022, 1, 5);
      // Monday, January 3, 2022
      const expectedMonday = LocalDate.of(2022, 1, 3);
      expect(getFirstDayOfWeek(wednesday).equals(expectedMonday)).toBe(true);

      // Sunday, January 9, 2022
      const sunday = LocalDate.of(2022, 1, 9);
      // Monday, January 3, 2022 (previous Monday)
      expect(getFirstDayOfWeek(sunday).equals(expectedMonday)).toBe(true);
    });
  });

  describe('formatDuration', () => {
    it('formats hours only when minutes are 0', () => {
      const duration = Duration.ofHours(5);
      expect(formatDuration(duration)).toBe('5h');
    });

    it('formats hours and minutes when minutes are not 0', () => {
      const duration = Duration.ofHours(5).plusMinutes(30);
      expect(formatDuration(duration)).toBe('5h30 ');
    });

    it('handles zero duration', () => {
      const duration = Duration.ZERO;
      expect(formatDuration(duration)).toBe('0h');
    });
  });

  describe('formatDurationAs100', () => {
    it('formats hours only when minutes are 0', () => {
      const duration = Duration.ofHours(5);
      console.log(formatDurationAs100(duration.plusMinutes(5)));
      expect(formatDurationAs100(duration)).toBe('5');
    });

    it('formats hours and minutes as decimal when minutes are not 0', () => {
      const duration = Duration.ofHours(5).plusMinutes(30);
      expect(formatDurationAs100(duration)).toBe('5,50');
    });

    it('handles zero duration with default null character', () => {
      const duration = Duration.ZERO;
      expect(formatDurationAs100(duration)).toBe('0');
    });

    it('handles zero duration with custom null character', () => {
      const duration = Duration.ZERO;
      expect(formatDurationAs100(duration, '-')).toBe('-');
    });

    it('pads minutes with leading zero when needed', () => {
      const duration = Duration.ofHours(5).plusMinutes(6);
      expect(formatDurationAs100(duration)).toBe('5,10');
    });
  });

  describe('getGreaterDuration', () => {
    it('returns the first duration when it is greater', () => {
      const d1 = Duration.ofHours(5);
      const d2 = Duration.ofHours(3);
      expect(getGreaterDuration(d1, d2)).toBe(d1);
    });

    it('returns the second duration when it is greater', () => {
      const d1 = Duration.ofHours(3);
      const d2 = Duration.ofHours(5);
      expect(getGreaterDuration(d1, d2)).toBe(d2);
    });

    it('returns either duration when they are equal', () => {
      const d1 = Duration.ofHours(5);
      const d2 = Duration.ofHours(5);
      const result = getGreaterDuration(d1, d2);
      expect(result.equals(d1)).toBe(true);
      expect(result.equals(d2)).toBe(true);
    });
  });

  describe('getLowerDuration', () => {
    it('returns the second duration when the first is greater', () => {
      const d1 = Duration.ofHours(5);
      const d2 = Duration.ofHours(3);
      expect(getLowerDuration(d1, d2)).toBe(d2);
    });

    it('returns the first duration when the second is greater', () => {
      const d1 = Duration.ofHours(3);
      const d2 = Duration.ofHours(5);
      expect(getLowerDuration(d1, d2)).toBe(d1);
    });

    it('returns either duration when they are equal', () => {
      const d1 = Duration.ofHours(5);
      const d2 = Duration.ofHours(5);
      const result = getLowerDuration(d1, d2);
      expect(result.equals(d1)).toBe(true);
      expect(result.equals(d2)).toBe(true);
    });
  });

  type WithDuration<T> = T & { duration: Duration };

  describe('getTotalDuration', () => {
    it('returns zero duration for an empty list', () => {
      const entities = List<WithDuration<Duration>>();
      expect(getTotalDuration(entities).equals(Duration.ZERO)).toBe(true);
    });

    it('returns the sum of durations for a list with one entity', () => {
      const entity = { duration: Duration.ofHours(5), id: 1 };
      const entities = List([entity]);
      expect(getTotalDuration(entities).equals(entity.duration)).toBe(true);
    });

    it('returns the sum of durations for a list with multiple entities', () => {
      const entity1 = { duration: Duration.ofHours(5), id: 1 };
      const entity2 = { duration: Duration.ofHours(3), id: 2 };
      const entity3 = { duration: Duration.ofHours(2).plusMinutes(30), id: 3 };
      const entities = List([entity1, entity2, entity3]);
      const expectedDuration = Duration.ofHours(10).plusMinutes(30);
      expect(getTotalDuration(entities).equals(expectedDuration)).toBe(true);
    });
  });
});
