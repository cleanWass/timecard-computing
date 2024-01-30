import { Instant, ZoneId } from '@js-joda/core';
import { Interval } from '@js-joda/extra';
import * as E from 'fp-ts/Either';
import { identity, pipe } from 'fp-ts/function';
import { List, Set } from 'immutable';
import { Leave } from '../../../domain/models/leave-recording/leave/leave';
import { LocalTimeSlot } from '../../../domain/models/local-time-slot';
import { Shift } from '../../../domain/models/mission-delivery/shift/shift';
import { WorkingPeriodTimecard } from '../../../domain/models/time-card-computation/timecard/working-period-timecard';

const isShiftDuringLeave = (shift: Shift) => (leave: Leave) =>
  leave.getInterval().contains(Instant.from(shift.startTime.atZone(ZoneId.of('Europe/Paris'))));

export const getCuratedShifts = (leave: Leave, shift: Shift) =>
  pipe(
    shift.getInterval(),
    E.fromPredicate(
      s => leave.getInterval().overlaps(s),
      () => List([shift])
    ),
    E.map(sh => {
      if (leave.getInterval().encloses(sh)) return List<Shift>([]);
      const beforeLeave = Interval.of(
        sh.start(),
        leave.getInterval().start().isBefore(sh.start()) ? sh.start() : leave.getInterval().start()
      );

      const afterLeave = Interval.of(leave.getInterval().end(), sh.end());

      return List([
        beforeLeave.toDuration().toMillis() > 0 &&
          shift.with({ id: `${shift.id}-before Leave ${leave.debug()}`, duration: beforeLeave.toDuration() }),
        afterLeave.toDuration().toMillis() > 0 &&
          shift.with({
            id: `${shift.id}-after Leave ${leave.debug()}`,
            startTime: leave.getEndDateTime(),
            duration: afterLeave.toDuration(),
          }),
      ]).filter(identity);
    }),
    E.getOrElse(() => List([shift]))
  );

export const filterShifts = (timecard: WorkingPeriodTimecard) => {
  const shifts = timecard.shifts.flatMap(shift => {
    const leaveDuringShift = timecard.leaves.find(isShiftDuringLeave(shift));
    return leaveDuringShift ? getCuratedShifts(leaveDuringShift, shift) : [shift];
  });

  return timecard.with({ shifts });
};

export const curateLeaves = (timecard: WorkingPeriodTimecard) => {
  const holidays = timecard.leaves.filter(leave => leave.absenceType === 'HOLIDAY');
  const planning = timecard.contract.weeklyPlanning;

  const holidayLeavesFromPlanning = holidays.flatMap(({ date }) =>
    planning.get(date.dayOfWeek(), Set<LocalTimeSlot>()).map(slot =>
      Leave.build({
        startTime: slot.startTime,
        endTime: slot.endTime,
        date,
        duration: slot.duration(),
        compensation: 'PAID',
        absenceType: 'HOLIDAY',
      })
    )
  );

  const filterOutPaidLeavesCanceledByHolidays = (leave: Leave) =>
    leave.compensation !== 'PAID' || !holidays.some(holiday => holiday.getInterval().overlaps(leave.getInterval()));

  const leaves = timecard.leaves
    .filterNot(leave => leave.absenceType === 'HOLIDAY')
    .filter(filterOutPaidLeavesCanceledByHolidays)
    .concat(holidayLeavesFromPlanning);

  return timecard.with({ leaves });
};
