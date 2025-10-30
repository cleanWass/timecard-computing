import { DateTimeFormatter, Duration, LocalDate } from '@js-joda/core';

import { pipe } from 'fp-ts/function';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import { List, Set } from 'immutable';
import { prepareEnv } from '../application/csv-generation/prepare-env';
import { computeTimecardForEmployee } from '../application/timecard-computation/compute-timecard-for-employee';
import { Employee } from '../domain/models/employee-registration/employee/employee';
import { EmploymentContract } from '../domain/models/employment-contract-management/employment-contract/employment-contract';
import { Bench } from '../domain/models/leave-recording/bench-recording/bench';
import { LocalDateRange } from '../domain/models/local-date-range';
import { LocalTimeSlot } from '../domain/models/local-time-slot';
import { WorkingPeriodTimecard } from '../domain/models/time-card-computation/timecard/working-period-timecard';
import { intercontractGenerationRoute } from '../infrastructure/route/intercontract-generation-route';
import { fetchIntercontractData } from '../infrastructure/server/intercontract-generation-route-service';
import { formatDurationAs100, formatLocalDate } from '../~shared/util/joda-helper';

type SlotsToCreate = {
  employee: Employee;
  contract: EmploymentContract;
  slot: LocalTimeSlot;
  duration: Duration;
  date: LocalDate;
};

const displayTimecardDebug = (
  timecards: Readonly<Array<WorkingPeriodTimecard>>,
  logger: ReturnType<typeof prepareEnv>['log']['logger']
) =>
  List(timecards)
    .sortBy(tc => tc.workingPeriod.period.start.toString())
    .forEach(tc => {
      logger(tc.debug());
      logger('-------------------');
      // logger(tc.contract.debug());
    });

const generateAffectationsForBenchesFromContractualPlanning = (timecard: WorkingPeriodTimecard) => {
  const contractualPlanning = timecard.contract.contractualPlanning;
  let difference = timecard.workedHours.TotalIntercontract.minus(
    Bench.totalBenchesDuration(timecard.benches)
  );
  console.log(
    `
    ${timecard.employee.firstName} ${timecard.employee.lastName} ${timecard.employee.silaeId}
    ${timecard.id} ${timecard.workingPeriod.period.toFormattedString()} ${formatDurationAs100(
      difference
    )}`
  );
  if (difference.isNegative() || difference.isZero()) return [];
  let currentDay = timecard.workingPeriod.period.start;
  let affectationsToCreate = Set<SlotsToCreate>();
  while (!difference.isZero() || !difference.isNegative()) {
    console.log(`Current day: ${currentDay.dayOfWeek().name()}`);
    const currentDayContractualSlots = contractualPlanning?.get(
      currentDay.dayOfWeek(),
      Set<LocalTimeSlot>()
    );
    console.log(
      `Current day contractual slots: ${currentDayContractualSlots?.map(s => s.debug()).join('\n')}`
    );
    const currentDayShiftsSlots = timecard.shifts
      .filter(shift => shift.getDate().equals(currentDay))
      .map(shift => shift.getTimeSlot())
      .concat(timecard.leaves.filter(l => l.date.equals(currentDay)).map(l => l.getTimeSlot()))
      .concat(timecard.benches.filter(b => b.date.equals(currentDay)).map(b => b.timeslot))
      .sortBy(slot => slot.startTime.toString());
    // .reduce((acc, slot, index) => {
    //   if (index === 0) {
    //     acc?.add(slot);
    //     return acc;
    //   }
    //   const previousSlot = acc?.last();
    //   if (previousSlot?.endTime.equals(slot.startTime)) {
    //     acc?.delete(previousSlot);
    //     acc?.add(new LocalTimeSlot(previousSlot.startTime, slot.endTime));
    //   } else {
    //     acc?.add(slot);
    //   }
    // }, Set<LocalTimeSlot>()) || Set<LocalTimeSlot>();
    console.log(
      `Current day shifts slots: ${currentDayShiftsSlots?.map(s => s.debug()).join('\n')}`
    );
    let index = 0;
    currentDayContractualSlots?.forEach(contractSlot => {
      console.log(`Contractual slot : ${contractSlot.debug()}`);

      const shiftsSlotsMatchingCurrentContractualSlot = currentDayShiftsSlots.filter(shiftSlot =>
        shiftSlot.overlaps(contractSlot)
      );
      console.log(
        `Slots matching current contractual slot : ${shiftsSlotsMatchingCurrentContractualSlot
          .map(s => s.debug())
          .join('\n')}`
      );

      let contractualSlotsAvailable = shiftsSlotsMatchingCurrentContractualSlot.reduce(
        (res, shiftSlot) => {
          let set = res.flatMap(partContractSlot => partContractSlot.subtract(shiftSlot));
          console.log(`Contractual slot ${contractSlot.debug()} - Shift slot ${shiftSlot.debug()}`);
          console.log('Result: ', set.map(s => s.debug()).join('\n'));
          return set;
        },
        Set<LocalTimeSlot>([contractSlot])
      );
      if (shiftsSlotsMatchingCurrentContractualSlot.isEmpty()) {
        console.log('No matching slot found for contractual slot');
        contractualSlotsAvailable = Set([contractSlot]);
      }
      console.log(
        `Total contractual slot time available for ${currentDay
          .dayOfWeek()
          .name()} : ${formatDurationAs100(
          contractualSlotsAvailable.reduce((acc, slot) => acc.plus(slot.duration()), Duration.ZERO)
        )}`
      );
      console.log(`Slots  ${contractualSlotsAvailable.map(s => s.debug()).join('\n')}`);
      const slotsToCreate = contractualSlotsAvailable.map(slot => ({
        employee: timecard.employee,
        contract: timecard.contract,
        slot,
        duration: slot.duration(),
        date: currentDay,
      }));
      console.log(
        `Slots to create : ${slotsToCreate.map(
          s => `${s.slot.debug()} ${formatDurationAs100(s.duration)}`
        )}`
      );
      affectationsToCreate = affectationsToCreate.union(slotsToCreate);
      difference = difference.minus(
        contractualSlotsAvailable.reduce((acc, slot) => acc.plus(slot.duration()), Duration.ZERO)
      );
      console.log(`Remaining hours to affect: ${formatDurationAs100(difference)}`);
      if (currentDayContractualSlots.size !== index + 1) console.log('- - - - - - - - - - - - ');
    });

    currentDay = currentDay.plusDays(1);
    console.log('----------------------------');

    if (currentDay.equals(timecard.workingPeriod.period.end)) break;
  }
  return affectationsToCreate.toArray();
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
              computationResult.timecards.flatMap(tc =>
                generateAffectationsForBenchesFromContractualPlanning(tc)
              ),
              d => {
                console.log(
                  `Generated ${d.length} bench affectations for ${cleanerData.employee.firstName} ${cleanerData.employee.lastName} ${cleanerData.employee.silaeId}`
                );
                console.log(
                  d
                    .map(({ date, slot }) => `${formatLocalDate({ date })} ${slot.debug()}`)
                    .join('\n')
                );
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
    // TE.tapIO(
    //   data => () =>
    //     console.log(
    //       data
    //         .map(
    //           ({ timecards, employee }) =>
    //             `${employee.debug()}
    //       ${timecards
    //         .map(
    //           tc =>
    //             `${tc.id} ${tc.workingPeriod.period.toFormattedString()}
    //           Bench duration : ${formatDurationAs100(Bench.totalBenchesDuration(tc.benches))} (${
    //             tc.benches.size
    //           } benches)
    //           Intercontract Computation : ${formatDurationAs100(tc.workedHours.TotalIntercontract)}
    //           `
    //         )
    //         .join('\n')}`
    //         )
    //         .join('\n-----------------------------------\n')
    //     )
    // ),
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
