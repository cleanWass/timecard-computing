import { DateTimeFormatter, DayOfWeek, Duration, LocalDate, LocalDateTime } from '@js-joda/core';
import { flow, pipe } from 'fp-ts/function';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import { List, Map, Set } from 'immutable';
import { Employee } from '../../domain/models/employee-registration/employee/employee';
import { EmploymentContract } from '../../domain/models/employment-contract-management/employment-contract/employment-contract';
import { Bench } from '../../domain/models/leave-recording/bench-recording/bench';
import { Leave } from '../../domain/models/leave-recording/leave/leave';
import { LocalDateRange } from '../../domain/models/local-date-range';
import { LocalTimeSlot } from '../../domain/models/local-time-slot';
import { Shift } from '../../domain/models/mission-delivery/shift/shift';
import { WorkingPeriodTimecard } from '../../domain/models/timecard-computation/timecard/working-period-timecard';
import { WeeklyTimecardRecap } from '../../domain/models/timecard-computation/weekly-timecard-recap/weekly-timecard-recap';
import { WorkingPeriod } from '../../domain/models/timecard-computation/working-period/working-period';
import { isDurationPositive } from '../../domain/~shared/utils/temporals-helper';
import { fetchIntercontractData } from '../../infrastructure/server/intercontract-generation-route-service';
import { validateEmployeeDataApiReturn } from '../../infrastructure/server/timecard-route-service';
import { formatLocalDate, getLowerDuration } from '../../~shared/util/joda-helper';
import { computeTimecardForEmployee } from '../timecard-computation/compute-timecard-for-employee';

type SlotToCreate = {
  employee: Employee;
  contract: EmploymentContract;
  slot: LocalTimeSlot;
  duration: Duration;
  date: LocalDate;
};

type AffectationContext = {
  timecard: WorkingPeriodTimecard;
  remainingDuration: Duration;
  currentDay: LocalDate;
  affectations: Set<SlotToCreate>;
};

type IntercontractResult = {
  shifts: Shift[];
  leaves: Leave[];
  contracts: EmploymentContract[];
  employee: Employee;
  timecards: WorkingPeriodTimecard[];
  benches: Bench[];
  weeklyRecaps: WeeklyTimecardRecap[];
  workingPeriods: WorkingPeriod[];
  period: LocalDateRange;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getCurrentDayShiftsSlots = (
  timecard: WorkingPeriodTimecard,
  currentDay: LocalDate
): List<LocalTimeSlot> =>
  timecard.shifts
    .filter(shift => shift.getDate().equals(currentDay))
    .map(shift => shift.getTimeSlot())
    .concat(timecard.leaves.filter(l => l.date.equals(currentDay)).map(l => l.getTimeSlot()))
    .concat(timecard.benches.filter(b => b.date.equals(currentDay)).map(b => b.timeslot))
    .sortBy(slot => slot.startTime.toString());

const calculateAvailableSlots = (
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

const processContractualSlot = (
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

    affectations = affectations.add({
      employee: ctx.timecard.employee,
      contract: ctx.timecard.contract,
      slot: new LocalTimeSlot(slot.startTime, slot.startTime.plus(duration)),
      duration,
      date: ctx.currentDay,
    });
  });

  return { ...ctx, remainingDuration, affectations };
};

const createAffectationsForDay = (
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

// ============================================================================
// MAIN GENERATION FUNCTIONS
// ============================================================================

const generateAffectationsForBenchesFromContractualPlanning = (
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
      };
      return acc.pop().push(mergedSlot);
    }

    return acc.push(current);
  }, List<SlotToCreate>());

  return merged.toSet();
};

const groupSameHoursSlots = (slots: Set<SlotToCreate>): Map<Set<DayOfWeek>, Set<SlotToCreate>> => {
  if (slots.isEmpty()) return Map<Set<DayOfWeek>, Set<SlotToCreate>>();

  return slots
    .groupBy(slot => `${slot.slot.startTime.toString()}-${slot.slot.endTime.toString()}`)
    .mapKeys((_, slotsForTimeRange) =>
      slotsForTimeRange.map(slot => slot.date.dayOfWeek()).toSet()
    );
};

// ============================================================================
// LOGGING
// ============================================================================

const logBenchAffectations = (
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

// ============================================================================
// INTERCONTRACT GENERATION
// ============================================================================

export const generateIntercontract = (period: LocalDateRange) => {
  let slotsToCreate = Map<string, Set<SlotToCreate>>();
  return pipe(
    TE.tryCatch(
      () => fetchIntercontractData(period),
      e => new Error(`Fetching cached data from care data parser went wrong ${e}`)
    ),
    TE.chainW(
      TE.traverseSeqArray(
        flow(
          validateEmployeeDataApiReturn,
          TE.tapIO(
            () => () =>
              console.log(`Generating intercontract for period ${period.toFormattedString()}`)
          ),
          TE.chain(flow(computeTimecardForEmployee(period), TE.fromEither)),
          TE.tapIO(
            d => () =>
              console.log(
                `Generated timecards for employee ${d.employee.firstName} ${d.employee.lastName} ${d.employee.silaeId}`
              )
          ),
          TE.map(computationResult => {
            const unregisteredBenches = computationResult.timecards.reduce(
              (acc, tc) =>
                acc.set(
                  tc.workingPeriod.period,
                  pipe(
                    tc,
                    generateAffectationsForBenchesFromContractualPlanning,
                    mergeContinuousTimeSlots,
                    slots => {
                      slotsToCreate = slotsToCreate.update(
                        computationResult.employee.silaeId,
                        Set<SlotToCreate>(),
                        s => s?.union(slots)
                      );
                      return slots;
                    },
                    groupSameHoursSlots
                  )
                ),
              Map<LocalDateRange, Map<Set<DayOfWeek>, Set<SlotToCreate>>>()
            );

            logBenchAffectations(
              slotsToCreate.get(computationResult.employee.silaeId)?.size || 0,
              unregisteredBenches,
              computationResult.employee
            );

            return {
              employee: computationResult.employee,
              timecards: computationResult.timecards,
              benches: List(computationResult.timecards.flatMap(tc => tc.benches.toArray())),
              weeklyRecaps: computationResult.weeklyRecaps,
              workingPeriods: computationResult.workingPeriods,
              period,
              benchesToCreate: slotsToCreate,
            };
          })
        )
      )
    ),
    TE.tapIO(
      d => () =>
        console.log(
          `Generated benches for ${d.length} employees for period ${period.toFormattedString()} : ${
            d.flatMap(e => e.benches).length
          } benches existing and ${
            slotsToCreate.reduce((acc, s) => acc.union(s), Set<SlotToCreate>()).size
          } to create.`
        )
    ),
    t => t,
    TE.foldW(
      e => {
        console.error('Error in intercontract generation:', e);
        return T.of(e);
      },
      result => T.of(result)
    )
  );
};
