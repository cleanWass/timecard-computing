import { Instant, LocalDateTime, ZoneId } from '@js-joda/core';
import { Interval } from '@js-joda/extra';
import * as E from 'fp-ts/Either';
import { identity, pipe } from 'fp-ts/function';
import { List } from 'immutable';
import { Leave } from '../../../domain/models/leave-recording/leave/leave';
import { LeavePeriod } from '../../../domain/models/leave-recording/leave/leave-period';
import { Shift } from '../../../domain/models/mission-delivery/shift/shift';
import { WorkingPeriodTimecard } from '../../../domain/models/time-card-computation/timecard/working-period-timecard';

const isShiftDuringLeavePeriod = (shift: Shift) => (leave: LeavePeriod) =>
  leave.getInterval().contains(Instant.from(shift.startTime.atZone(ZoneId.of('Europe/Paris'))));

export const getCuratedShifts = (leave: LeavePeriod, shift: Shift) => {
  return pipe(
    shift.getInterval(),
    E.fromPredicate(
      s => leave.getInterval().overlaps(s),
      () => List([shift])
    ),
    E.map(sh => {
      if (leave.getInterval().encloses(sh)) return List<Shift>([]);
      const beforeLeave = Interval.of(sh.start(), leave.getInterval().start());
      const afterLeave = Interval.of(leave.getInterval().end(), sh.end());

      return List([
        beforeLeave.toDuration().toMillis() > 0 &&
          shift.with({ id: `${shift.id}-before Leave ${leave.id}`, duration: beforeLeave.toDuration() }),
        afterLeave.toDuration().toMillis() > 0 &&
          shift.with({
            id: `${shift.id}-after Leave ${leave.id}`,
            startTime: LocalDateTime.of(leave.period.end, leave.endTime),
            duration: afterLeave.toDuration(),
          }),
      ]).filter(identity);
    }),
    E.getOrElse(() => List([shift]))
  );
};

export const filterShifts = (timecard: WorkingPeriodTimecard) => {
  const shifts = timecard.shifts.flatMap(shift => {
    const leaveDuringShift = timecard.leavePeriods.find(isShiftDuringLeavePeriod(shift));
    return leaveDuringShift ? getCuratedShifts(leaveDuringShift, shift) : [shift];
  });

  return timecard.with({ shifts });
};

export const curateLeaves = (timecard: WorkingPeriodTimecard) => {
  const leaves = timecard.leavePeriods.flatMap(leavePeriod =>
    timecard.shifts
      .filter(s => leavePeriod.containsShift(s))
      .map(shift => {
        let intersection = leavePeriod.getInterval().intersection(shift.getInterval());
        return Leave.build({
          reason: leavePeriod.reason,
          startTime: LocalDateTime.ofInstant(intersection.start(), ZoneId.of('Europe/Paris')),
          duration: intersection.toDuration(),
        });
      })
  );
  return timecard.with({ leaves });
};
