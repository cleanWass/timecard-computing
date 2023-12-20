import { Duration, LocalDateTime } from '@js-joda/core';
import { List, Set } from 'immutable';
import { LocalTimeSlot } from '../../domain/models/local-time-slot';
import { TheoreticalShift } from '../../domain/models/mission-delivery/shift/theorical-shift';
import { WorkingPeriodTimecard } from '../../domain/models/time-card-computation/timecard/working-period-timecard';
import { getFirstDayOfWeek } from '../../~shared/util/joda-helper';

const generateTheoreticalShift = (timecard: WorkingPeriodTimecard) => {
  return List(
    timecard.workingPeriod.period
      .with({
        start: getFirstDayOfWeek(timecard.workingPeriod.period.start),
        end: getFirstDayOfWeek(timecard.workingPeriod.period.start).plusDays(timecard.contract.overtimeAveragingPeriod.toDays()),
      })
      .toLocalDateArray()
      .filter(d => !timecard.workingPeriod.period.contains(d))
      .flatMap(day =>
        timecard.contract.weeklyPlanning
          .get(day.dayOfWeek(), Set<LocalTimeSlot>())
          .map(timeSlot =>
            TheoreticalShift.build({
              duration: timeSlot.duration(),
              employeeId: timecard.employee.id,
              startTime: LocalDateTime.of(day, timeSlot.startTime),
            })
          )
          .toArray()
      )
  );
};

export const generateTheoreticalShiftIfPartialWeek = (wpTimecard: WorkingPeriodTimecard) => {
  if (wpTimecard.workingPeriod.isComplete(wpTimecard.contract)) return wpTimecard;

  const theoreticalShifts = generateTheoreticalShift(wpTimecard);
  return wpTimecard.with({ theoreticalShifts }).register(
    'TotalTheoretical',
    theoreticalShifts.reduce((acc, sh) => acc.plus(sh.duration), Duration.ZERO)
  );
};
