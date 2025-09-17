import { Interval } from '@js-joda/extra';
import * as E from 'fp-ts/Either';
import { identity, pipe } from 'fp-ts/function';
import { List, Set } from 'immutable';
import { Leave } from '../../../domain/models/leave-recording/leave/leave';
import { LocalTimeSlot } from '../../../domain/models/local-time-slot';
import { Shift } from '../../../domain/models/mission-delivery/shift/shift';
import { WorkingPeriodTimecard } from '../../../domain/models/time-card-computation/timecard/working-period-timecard';

const isShiftDuringLeave = (shift: Shift) => (leave: Leave) =>
  leave.date.isEqual(shift.getDate()) &&
  new LocalTimeSlot(leave.startTime, leave.endTime).overlaps(
    new LocalTimeSlot(shift.startTime.toLocalTime(), shift.getEndLocalTime())
  );

export const getCuratedShifts = (leave: Leave, shift: Shift) =>
  pipe(
    shift.getTimeSlot(),
    E.fromPredicate(
      s => leave.getTimeSlot().overlaps(s),
      () => List([shift])
    ),
    E.map(sh => {
      if (leave.getTimeSlot().includesInclusive(sh)) return List<Shift>([]);
      const beforeLeave = new LocalTimeSlot(
        sh.startTime,
        leave.getTimeSlot().startTime.isBefore(sh.startTime)
          ? sh.startTime
          : leave.getTimeSlot().startTime
      );

      const endOfAfterLeave = leave.getTimeSlot().endTime.isAfter(sh.endTime)
        ? leave.getTimeSlot().endTime
        : sh.endTime;
      const afterLeave = new LocalTimeSlot(leave.getTimeSlot().endTime, endOfAfterLeave);

      return List([
        beforeLeave.duration().toMillis() > 0 &&
          shift.with({
            id: `${shift.id}-before Leave_${leave.date.toString()}`,
            duration: beforeLeave.duration(),
          }),
        afterLeave.duration().toMillis() > 0 &&
          shift.with({
            id: `${shift.id}-after Leave_${leave.date.toString()}`,
            startTime: leave.getEndDateTime(),
            duration: afterLeave.duration(),
          }),
      ]).filter(identity);
    }),
    E.getOrElse(() => List([shift]))
  );

export const filterBenchingShifts = (timecard: WorkingPeriodTimecard) =>
  timecard.with({
    shifts: timecard.shifts.filter(
      shift => shift.clientId !== '0010Y00000Ijn8cQAB' || shift.type !== 'Intercontrat'
    ),
  });

export const filterShifts = (timecard: WorkingPeriodTimecard) => {
  const shifts = timecard.shifts.flatMap(shift => {
    const leaveDuringShift = timecard.leaves.find(isShiftDuringLeave(shift));
    return leaveDuringShift ? getCuratedShifts(leaveDuringShift, shift) : [shift];
  });

  return timecard.with({ shifts });
};

export const curateLeaves = (timecard: WorkingPeriodTimecard) => {
  const holidays = timecard.leaves.filter(leave => leave.absenceType === 'HOLIDAY');
  const planning = timecard.weeklyPlanning;

  const holidayLeavesFromPlanning = holidays.flatMap(({ date, id, clientId, clientName }) =>
    planning.get(date.dayOfWeek(), Set<LocalTimeSlot>()).map(slot =>
      Leave.build({
        id: `${id}-${date.toString()}-${slot.startTime.toString()}-${slot.endTime.toString()}`,
        employeeId: timecard.employee.silaeId || timecard.employee.id,
        clientId,
        clientName,
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
    leave.compensation !== 'PAID' ||
    !holidays.some(holiday => holiday.getTimeSlot().overlaps(leave.getTimeSlot()));

  const leaves = timecard.leaves
    .filterNot(leave => leave.absenceType === 'HOLIDAY')
    .filter(filterOutPaidLeavesCanceledByHolidays)
    .concat(holidayLeavesFromPlanning);

  return timecard.with({ leaves });
};
