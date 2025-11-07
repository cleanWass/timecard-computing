import { DayOfWeek, Duration, LocalTime } from '@js-joda/core';
import { Map, Set } from 'immutable';
import { LocalTimeSlot } from '../../../models/local-time-slot';
import { WorkingPeriodTimecard } from '../../../models/timecard-computation/timecard/working-period-timecard';
import { BenchAffectation, SlotToCreate } from '../types';

export const buildBenchAffectation =
  (timecard: WorkingPeriodTimecard) =>
  (groupedByDaysSlots: Map<Set<DayOfWeek>, Set<SlotToCreate>>) =>
    groupedByDaysSlots
      .map(
        (slots, days) =>
          ({
            slot: slots.first()?.slot || new LocalTimeSlot(LocalTime.MIN, LocalTime.MIN),
            days,
            duration: slots.first()?.duration || Duration.ZERO,
            period: timecard.workingPeriod.period,
            employee: timecard.employee,
            isDuringLeavePeriod: slots.some(sl => sl.isDuringLeavePeriod),
          }) satisfies BenchAffectation
      )
      .toSet();
