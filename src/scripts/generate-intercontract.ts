import { DateTimeFormatter, DayOfWeek, Duration, LocalDate, LocalDateTime } from '@js-joda/core';

import { pipe } from 'fp-ts/function';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import { List, Map, Set } from 'immutable';
import { computeTimecardForEmployee } from '../application/timecard-computation/compute-timecard-for-employee';
import { Employee } from '../domain/models/employee-registration/employee/employee';
import { EmploymentContract } from '../domain/models/employment-contract-management/employment-contract/employment-contract';
import { Bench } from '../domain/models/leave-recording/bench-recording/bench';
import { LocalDateRange } from '../domain/models/local-date-range';
import { LocalTimeSlot } from '../domain/models/local-time-slot';
import { WorkingPeriodTimecard } from '../domain/models/time-card-computation/timecard/working-period-timecard';
import { intercontractGenerationRoute } from '../infrastructure/route/intercontract-generation-route';
import { fetchIntercontractData } from '../infrastructure/server/intercontract-generation-route-service';
import { formatLocalDate, getLowerDuration } from '../~shared/util/joda-helper';

type SlotToCreate = {
  employee: Employee;
  contract: EmploymentContract;
  slot: LocalTimeSlot;
  duration: Duration;
  date: LocalDate;
};

const isDurationPositive = (duration: Duration) => !duration.isNegative() && !duration.isZero();

const getCurrentDayShiftsSlots = (timecard: WorkingPeriodTimecard, currentDay: LocalDate) =>
  timecard.shifts
    .filter(shift => shift.getDate().equals(currentDay))
    .map(shift => shift.getTimeSlot())
    .concat(timecard.leaves.filter(l => l.date.equals(currentDay)).map(l => l.getTimeSlot()))
    .concat(timecard.benches.filter(b => b.date.equals(currentDay)).map(b => b.timeslot))
    .sortBy(slot => slot.startTime.toString());

const generateAffectationsForBenchesFromContractualPlanning = (timecard: WorkingPeriodTimecard) => {
  const contractualPlanning = timecard.contract.contractualPlanning;
  let difference = timecard.workedHours.TotalIntercontract.minus(
    Bench.totalBenchesDuration(timecard.benches)
  );
  let currentDay = timecard.workingPeriod.period.start;
  let affectationsToCreate = Set<SlotToCreate>();
  while (isDurationPositive(difference) && !currentDay.equals(timecard.workingPeriod.period.end)) {
    const currentDayContractualSlots = contractualPlanning?.get(
      currentDay.dayOfWeek(),
      Set<LocalTimeSlot>()
    );
    const currentDayShiftsSlots = getCurrentDayShiftsSlots(timecard, currentDay);

    currentDayContractualSlots?.forEach(contractSlot => {
      const shiftsSlotsMatchingCurrentContractualSlot = currentDayShiftsSlots.filter(shiftSlot =>
        shiftSlot.overlaps(contractSlot)
      );

      let contractualSlotsAvailable = shiftsSlotsMatchingCurrentContractualSlot.reduce(
        (res, shiftSlot) => res.flatMap(partContractSlot => partContractSlot.subtract(shiftSlot)),
        Set<LocalTimeSlot>([contractSlot])
      );
      if (shiftsSlotsMatchingCurrentContractualSlot.isEmpty()) {
        contractualSlotsAvailable = Set([contractSlot]);
      }

      let slotsToCreate = Set<SlotToCreate>();
      contractualSlotsAvailable.forEach(slot => {
        if (difference.isNegative() || difference.isZero()) return;
        const duration = getLowerDuration(slot.duration(), difference);

        difference = difference.minus(duration);
        slotsToCreate = slotsToCreate.add({
          employee: timecard.employee,
          contract: timecard.contract,
          slot: new LocalTimeSlot(slot.startTime, slot.startTime.plus(duration)),
          duration,
          date: currentDay,
        });
      });
      affectationsToCreate = affectationsToCreate.union(slotsToCreate);
    });

    currentDay = currentDay.plusDays(1);
  }
  return affectationsToCreate;
};

const mergeContinuousTimeSlots = (slots: Set<SlotToCreate>) => {
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

const groupSameHoursSlots = (slots: Set<SlotToCreate>) => {
  if (slots.isEmpty()) return Map<Set<DayOfWeek>, Set<SlotToCreate>>();

  return slots
    .groupBy(slot => `${slot.slot.startTime.toString()}-${slot.slot.endTime.toString()}`)
    .mapKeys((_, slotsForTimeRange) =>
      slotsForTimeRange.map(slot => slot.date.dayOfWeek()).toSet()
    );
};

export const generateIntercontract = async ({ period }: { period: LocalDateRange }) => {
  return await pipe(
    TE.tryCatch(
      () => fetchIntercontractData(period),
      e => {
        return new Error(`Fetching cached data from care data parser went wrong ${e}`);
      }
    ),
    TE.chain(payload => intercontractGenerationRoute(payload)),
    TE.chainW(
      TE.traverseSeqArray(cleanerData => {
        return pipe(
          TE.Do,
          TE.bind('data', () => TE.right(cleanerData)),
          TE.bind('computationResult', ({ data }) =>
            pipe(computeTimecardForEmployee(period)(data), TE.fromEither)
          ),
          TE.bind('unregisteredBenches', ({ computationResult }) => {
            return pipe(
              computationResult.timecards.reduce(
                (acc, tc) =>
                  acc.set(
                    tc.workingPeriod.period,
                    pipe(
                      tc,
                      generateAffectationsForBenchesFromContractualPlanning,
                      mergeContinuousTimeSlots,
                      groupSameHoursSlots
                    )
                  ),
                Map<LocalDateRange, Map<Set<DayOfWeek>, Set<SlotToCreate>>>()
              ),
              d => {
                console.log(
                  `Generated ${d.size} bench affectations for ${cleanerData.employee.firstName} ${cleanerData.employee.lastName} ${cleanerData.employee.silaeId}`
                );
                d.forEach((groupedSlots, week) => {
                  console.log(`Week ${week.toFormattedString()}`);
                  groupedSlots.forEach((slots, daysOfWeek) => {
                    console.log(`Days of week: ${daysOfWeek.map(d => d.toString()).join(', ')}`);
                    console.log(
                      `Slots: ${slots
                        .map(
                          ({ slot, date }) =>
                            `${formatLocalDate({
                              date,
                            })} ${slot.debug()}`
                        )
                        .join(', ')}`
                    );
                    console.log('');
                  });
                });
              },
              () => TE.of([])
            );
          }),
          TE.map(({ data, computationResult }) => ({
            shifts: data.shifts,
            leaves: data.leaves,
            contracts: data.contracts,
            employee: computationResult.employee,
            timecards: computationResult.timecards,
            benches: computationResult.timecards.flatMap(tc => tc.benches),
            weeklyRecaps: computationResult.weeklyRecaps,
            workingPeriods: computationResult.workingPeriods,
            period,
          }))
        );
      })
    ),
    TE.map(data => {
      return data;
    }),
    TE.foldW(
      e => {
        console.error('Error in TE.fold:', e);
        return T.of(e);
      },
      result => T.of(result)
    )
  )();
};

async function main() {
  try {
    console.log('start generatePayrollExports', process.argv[2]);
    const start = LocalDate.parse(process.argv[2], DateTimeFormatter.ofPattern('dd/MM/yy'));
    const end = LocalDate.parse(process.argv[3], DateTimeFormatter.ofPattern('dd/MM/yy'));
    const period = new LocalDateRange(start, end.plusDays(1));
    return await generateIntercontract({ period });
  } catch (e) {
    console.error(e);
  }
}

main().catch(e => console.error(e));
