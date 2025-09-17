import { LocalDateTime } from '@js-joda/core';
import { List, Set } from 'immutable';
import { LocalTimeSlot } from '../../../domain/models/local-time-slot';
import { InactiveShift } from '../../../domain/models/mission-delivery/shift/inactive-shift';
import { WorkingPeriodTimecard } from '../../../domain/models/time-card-computation/timecard/working-period-timecard';
import { getFirstDayOfWeek, getTotalDuration } from '../../../~shared/util/joda-helper';

export const generateInactiveShifts = (timecard: WorkingPeriodTimecard) => {
  return List(
    timecard.workingPeriod.period
      .with({
        start: getFirstDayOfWeek(timecard.workingPeriod.period.start),
        end: getFirstDayOfWeek(timecard.workingPeriod.period.start).plusDays(
          timecard.contract.overtimeAveragingPeriod.toDays()
        ),
      })
      .toLocalDateArray()
      .filter(d => !timecard.workingPeriod.period.contains(d))
      .flatMap(day =>
        timecard.weeklyPlanning
          .get(day.dayOfWeek(), Set<LocalTimeSlot>())
          .map(timeSlot =>
            InactiveShift.build({
              duration: timeSlot.duration(),
              employeeId: timecard.employee.id,
              startTime: LocalDateTime.of(day, timeSlot.startTime),
            })
          )
          .toArray()
      )
  );
};

export const generateInactiveShiftsIfPartialWeek = (wpTimecard: WorkingPeriodTimecard) => {
  if (wpTimecard.workingPeriod.isComplete(wpTimecard.contract)) return wpTimecard;

  const inactiveShifts = generateInactiveShifts(wpTimecard);
  return wpTimecard.with({ inactiveShifts }).register('TotalInactiveShifts', getTotalDuration(inactiveShifts));
};
