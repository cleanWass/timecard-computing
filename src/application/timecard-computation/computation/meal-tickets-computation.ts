import { Duration, LocalDate, LocalTime } from '@js-joda/core';
import { pipe } from 'fp-ts/function';
import { LocalTimeSlot } from '../../../domain/models/local-time-slot';
import { WorkingPeriodTimecard } from '../../../domain/models/time-card-computation/timecard/working-period-timecard';
import { getTotalDuration } from '../../../~shared/util/joda-helper';

export const computeMealTickets = (timecard: WorkingPeriodTimecard) => {
  const noon = LocalTime.NOON;
  const breakStart = LocalTime.of(11);
  const breakEnd = LocalTime.of(15);

  return timecard.with({
    mealTickets: pipe(timecard, tc => {
      const shiftsByDay = tc.shifts.groupBy(shift => shift.startTime.dayOfWeek());

      // TODO passer en option
      return shiftsByDay.reduce((mealtickets, shiftsOfDay, day) => {
        if (tc.contract.isFullTime()) return mealtickets + 1;
        if (tc.employee.seniorityDate.isAfter(LocalDate.now().minusDays(15))) return mealtickets;
        if (getTotalDuration(shiftsOfDay).compareTo(Duration.ofHours(6)) < 0) return mealtickets;
        if (!shiftsOfDay.some(shift => shift.getStartTime().toLocalTime().isBefore(noon))) return mealtickets;
        if (!shiftsOfDay.some(shift => shift.getEndTime().toLocalTime().isAfter(noon))) return mealtickets;
        const breakLunch = new LocalTimeSlot(breakStart, breakEnd);
        const shiftsDuringBreakLunch = shiftsOfDay.filter(shift => shift.getTimeSlot().overlaps(breakLunch));
        if (shiftsDuringBreakLunch.size > 1) return mealtickets + 1;
        if (shiftsDuringBreakLunch.some(shift => breakLunch.isIncludedIn(shift.getTimeSlot()))) return mealtickets + 1;
        return mealtickets;
      }, 0);
    }),
  });
};
