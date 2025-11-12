import { DayOfWeek, LocalDate, LocalDateTime } from '@js-joda/core';
import { pipe } from 'fp-ts/function';
import * as O from 'fp-ts/Option';
import { List, Map, Set } from 'immutable';
import { formatLocalDate, getLowerDuration } from '../../../~shared/util/joda-helper';
import { Employee } from '../../models/employee-registration/employee/employee';
import { Bench } from '../../models/leave-recording/bench-recording/bench';
import { LocalDateRange } from '../../models/local-date-range';
import { LocalTimeSlot } from '../../models/local-time-slot';
import { WorkingPeriodTimecard } from '../../models/timecard-computation/timecard/working-period-timecard';
import { isDurationPositive } from '../../~shared/utils/temporals-helper';
import { AffectationContext, SlotToCreate } from './types';

export const getCurrentDayShiftsSlots = (
  timecard: WorkingPeriodTimecard,
  currentDay: LocalDate
): List<LocalTimeSlot> =>
  timecard.shifts
    .filter(shift => shift.getDate().equals(currentDay))
    .map(shift => shift.getTimeSlot())
    .concat(timecard.leaves.filter(l => l.date.equals(currentDay)).map(l => l.getTimeSlot()))
    .concat(timecard.benches.filter(b => b.date.equals(currentDay)).map(b => b.timeslot))
    .sortBy(slot => slot.startTime.toString());

export const calculateAvailableSlots = (
  contractSlot: LocalTimeSlot,
  shiftsSlots: List<LocalTimeSlot>
): Set<LocalTimeSlot> => {
  const concurrentSlots = shiftsSlots.filter(shift => shift.overlaps(contractSlot));

  if (concurrentSlots.isEmpty()) {
    return Set([contractSlot]);
  }

  return concurrentSlots.reduce(
    (available, shift) => available.flatMap(slot => slot.subtract(shift)),
    Set<LocalTimeSlot>([contractSlot])
  );
};

export const processContractualSlot = (
  ctx: AffectationContext,
  contractSlot: LocalTimeSlot,
  shiftsSlots: List<LocalTimeSlot>
): AffectationContext => {
  const availableSlots = calculateAvailableSlots(contractSlot, shiftsSlots);

  let remainingDuration = ctx.remainingDuration;
  let affectations = ctx.affectations;

  availableSlots.forEach(slot => {
    if (!isDurationPositive(remainingDuration)) return;

    const duration = getLowerDuration(slot.duration(), remainingDuration);
    remainingDuration = remainingDuration.minus(duration);

    let timeSlot = new LocalTimeSlot(slot.startTime, slot.startTime.plus(duration));
    affectations = affectations.add({
      employee: ctx.timecard.employee,
      contract: ctx.timecard.contract,
      slot: timeSlot,
      duration,
      date: ctx.currentDay,
      isDuringLeavePeriod: ctx.timecard.leavePeriods.some(
        leavePeriod =>
          leavePeriod.period.includesDate(ctx.currentDay) &&
          pipe(
            leavePeriod.timeSlot,
            O.fold(
              () => true,
              ts => ts.overlaps(timeSlot)
            )
          )
      ),
    });
  });

  return { ...ctx, remainingDuration, affectations };
};

export const createAffectationsForDay = (
  ctx: AffectationContext,
  contractualSlots: Set<LocalTimeSlot>
): AffectationContext => {
  const shiftsSlots = getCurrentDayShiftsSlots(ctx.timecard, ctx.currentDay);

  let updatedCtx = ctx;

  contractualSlots.forEach(contractSlot => {
    updatedCtx = processContractualSlot(updatedCtx, contractSlot, shiftsSlots);
  });

  return updatedCtx;
};

export const generateAffectationsForBenchesFromContractualPlanning = (
  timecard: WorkingPeriodTimecard
): Set<SlotToCreate> => {
  const { contract, workingPeriod, workedHours, benches } = timecard;
  const contractualPlanning = contract.contractualPlanning;

  if (!contractualPlanning) return Set();

  let ctx: AffectationContext = {
    timecard,
    remainingDuration: workedHours.TotalIntercontract.minus(Bench.totalBenchesDuration(benches)),
    currentDay: workingPeriod.period.start,
    affectations: Set(),
  };

  while (
    isDurationPositive(ctx.remainingDuration) &&
    ctx.currentDay.isBefore(workingPeriod.period.end)
  ) {
    const contractualSlots = contractualPlanning.get(
      ctx.currentDay.dayOfWeek(),
      Set<LocalTimeSlot>()
    );

    ctx = createAffectationsForDay(ctx, contractualSlots);
    ctx = { ...ctx, currentDay: ctx.currentDay.plusDays(1) };
  }

  return ctx.affectations;
};

export const mergeContinuousTimeSlots = (slots: Set<SlotToCreate>): Set<SlotToCreate> => {
  if (slots.isEmpty()) return slots;

  const sorted = slots
    .sortBy(slot => LocalDateTime.of(slot.date, slot.slot.startTime).toString())
    .toList();

  const merged = sorted.reduce((acc, current) => {
    if (acc.isEmpty()) {
      return acc.push(current);
    }

    const last = acc.last()!;

    const isSameDate = last.date.equals(current.date);
    const areContiguous = last.slot.endTime.equals(current.slot.startTime);

    if (isSameDate && areContiguous) {
      const mergedSlot: SlotToCreate = {
        employee: last.employee,
        contract: last.contract,
        date: last.date,
        slot: new LocalTimeSlot(last.slot.startTime, current.slot.endTime),
        duration: last.duration.plus(current.duration),
        isDuringLeavePeriod: last.isDuringLeavePeriod,
      };
      return acc.pop().push(mergedSlot);
    }

    return acc.push(current);
  }, List<SlotToCreate>());

  return merged.toSet();
};

export const groupSameHoursSlots = (
  slots: Set<SlotToCreate>
): Map<Set<DayOfWeek>, Set<SlotToCreate>> => {
  if (slots.isEmpty()) return Map<Set<DayOfWeek>, Set<SlotToCreate>>();

  return slots
    .groupBy(
      slot =>
        `${slot.slot.startTime.toString()}-${slot.slot.endTime.toString()}-${
          slot.isDuringLeavePeriod
        }`
    )
    .mapKeys((_, slotsForTimeRange) =>
      slotsForTimeRange.map(slot => slot.date.dayOfWeek()).toSet()
    );
};

export const logBenchAffectations = (
  size: number,
  benches: Map<LocalDateRange, Map<Set<DayOfWeek>, Set<SlotToCreate>>>,
  employee: Employee
): void => {
  console.log(
    `Generated ${size} bench affectations for ${employee.firstName} ${employee.lastName} ${employee.silaeId}`
  );

  benches.forEach((groupedSlots, week) => {
    console.log(`Week ${week.toFormattedString()}`);
    groupedSlots.forEach((slots, daysOfWeek) => {
      console.log(`Days: ${daysOfWeek.map(d => d.toString()).join(', ')}`);
      console.log(
        `Slots: ${slots
          .map(({ slot, date }) => `${formatLocalDate({ date })} ${slot.debug()}`)
          .join(', ')}`
      );
      console.log('');
    });
  });
};
