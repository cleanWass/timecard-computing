import { Duration, LocalDate, LocalTime } from '@js-joda/core';
import { pipe } from 'fp-ts/function';
import { LocalTimeSlot } from '../../../domain/models/local-time-slot';
import { WorkingPeriodTimecard } from '../../../domain/models/time-card-computation/timecard/working-period-timecard';
import { getTotalDuration } from '../../../~shared/util/joda-helper';

const noon = LocalTime.NOON;
const breakStart = LocalTime.of(11);
const breakEnd = LocalTime.of(15);
const breakLunch = new LocalTimeSlot(breakStart, breakEnd);

export const computeMealTickets = (timecard: WorkingPeriodTimecard) =>
  timecard.with({
    mealTickets: pipe(timecard, (tc) => {
      const shiftsByDay = tc.shifts.groupBy((shift) => shift.startTime.dayOfWeek());

      return shiftsByDay.reduce((tickets, shiftsOfDay) => {
        if (tc.contract.isFullTime()) return tickets + 1;

        const hasNotSeniority = tc.employee.seniorityDate.isAfter(LocalDate.now().minusDays(15));
        const hasNotEnoughHours = getTotalDuration(shiftsOfDay).compareTo(Duration.ofHours(6)) < 0;
        const hasNoMorningShift = !shiftsOfDay.some((shift) => shift.getStartTime().toLocalTime().isBefore(noon));
        const hasNoEveningShift = !shiftsOfDay.some((shift) => shift.getEndTime().toLocalTime().isAfter(noon));

        if (hasNotSeniority || hasNotEnoughHours || hasNoMorningShift || hasNoEveningShift) return tickets;

        const shiftsDuringBreakLunch = shiftsOfDay.filter((shift) => shift.getTimeSlot().overlaps(breakLunch));
        return shiftsDuringBreakLunch.size > 1 ||
          shiftsDuringBreakLunch.some((shift) => shift.getTimeSlot().includesInclusive(breakLunch))
          ? tickets + 1
          : tickets;
      }, 0);
    }),
  });
