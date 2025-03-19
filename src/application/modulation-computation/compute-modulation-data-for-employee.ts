import { ChronoUnit, DayOfWeek, LocalDate } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import * as O from 'fp-ts/Option';
import { List, Map, Set } from 'immutable';
import '@js-joda/timezone';
import { Employee } from '../../domain/models/employee-registration/employee/employee';
import { EmploymentContract } from '../../domain/models/employment-contract-management/employment-contract/employment-contract';
import { Leave } from '../../domain/models/leave-recording/leave/leave';
import { LocalDateRange } from '../../domain/models/local-date-range';
import { LocalTimeSlot } from '../../domain/models/local-time-slot';
import { Shift } from '../../domain/models/mission-delivery/shift/shift';
import { ModulationDataMonthlyCard } from '../../domain/models/modulation-data/modulation-data-monthly-card';
import { ModulationDataRecap } from '../../domain/models/modulation-data/modulation-data-recap';
import { ModulationDataWeeklyCard } from '../../domain/models/modulation-data/modulation-data-weekly-card';
import { ModulationDataWorkingPeriodCard } from '../../domain/models/modulation-data/modulation-data-working-period-card';
import { WorkedHoursRecap } from '../../domain/models/time-card-computation/timecard/worked-hours-rate';
import { WorkingPeriodTimecard } from '../../domain/models/time-card-computation/timecard/working-period-timecard';
import { WeeklyTimecardRecap } from '../../domain/models/time-card-computation/weekly-timecard-recap/weekly-timecard-recap';
import { WorkingPeriod } from '../../domain/models/time-card-computation/working-period/working-period';
import { TimecardComputationError } from '../../~shared/error/TimecardComputationError';
import { sequenceList } from '../../~shared/util/sequence-list';
import {
  computeLeavesHours,
  computeWorkedHours,
} from '../timecard-computation/computation/base-hours-computation';
import { computeWorkingPeriods } from '../timecard-computation/computation/working-period-computation';

function initializeModulationDataWorkingPeriodCard(
  contract: EmploymentContract,
  employee: Employee,
  leaves: List<Leave>,
  workingPeriod: WorkingPeriod,
  shifts: List<Shift>
) {
  return ModulationDataWorkingPeriodCard.build({
    contract,
    employee,
    leaves: leaves.filter(l => workingPeriod.period.includesDate(l.date)),
    shifts: shifts.filter(s => workingPeriod.period.includesDate(s.getDate())),
    workingPeriod,
    weeklyPlanning: contract.weeklyPlannings.get(
      workingPeriod.period,
      Map<DayOfWeek, Set<LocalTimeSlot>>()
    ),
    workedHours: new WorkedHoursRecap(),
  });
}

export const computeModulationDataForEmployee =
  (period: LocalDateRange) =>
  ({
    employee,
    shifts,
    contracts,
    leaves,
  }: {
    employee: Employee;
    shifts: List<Shift>;
    leaves: List<Leave>;
    contracts: List<EmploymentContract>;
  }) => {
    return pipe(
      E.Do,
      E.bind('recap', () =>
        E.right(
          ModulationDataRecap.build({
            employmentContracts: contracts,
            modulationDataWeeklyCards: List<ModulationDataWeeklyCard>(),
            modulationDataWorkingPeriodCards: List<ModulationDataWorkingPeriodCard>(),
            modulationDataMonthlyCards: List<ModulationDataMonthlyCard>(),
            period: period,
            workingPeriods: List<WorkingPeriod>(),
            employee,
          })
        )
      ),
      E.bind('weeks', () => E.right(period.divideIntoCalendarWeeks())),
      E.bind('workingsPeriods', ({ weeks }) => pipe(contracts, computeWorkingPeriods(period))),
      E.bind('modulationDataWorkingPeriodRecaps', ({ workingsPeriods }) =>
        pipe(
          workingsPeriods.map(workingPeriod =>
            pipe(
              workingPeriod,
              findContract(contracts),
              E.map(contract =>
                pipe(
                  initializeModulationDataWorkingPeriodCard(
                    contract,
                    employee,
                    leaves,
                    workingPeriod,
                    shifts
                  ),
                  computeWorkedHours,
                  computeLeavesHours
                )
              )
            )
          ),
          sequenceList,
          c => c
        )
      ),
      E.bind(
        'modulationDataWeeklyRecaps',
        ({ weeks, workingsPeriods, modulationDataWorkingPeriodRecaps }) =>
          pipe(
            weeks.map(week =>
              pipe(
                week,
                findContracts(contracts),
                E.map(employmentContracts =>
                  ModulationDataWeeklyCard.build({
                    employee,
                    employmentContracts,
                    modulationDataWorkingPeriodCards: modulationDataWorkingPeriodRecaps.filter(
                      wpr => wpr.workingPeriod.period.overlaps(week)
                    ) as List<ModulationDataWorkingPeriodCard>,
                    week,
                    workingPeriods: workingsPeriods.filter(wps => week.includesRange(wps.period)),
                  })
                )
              )
            ),
            sequenceList
          )
      ),
      E.map(
        ({
          workingsPeriods,
          modulationDataWeeklyRecaps,
          modulationDataWorkingPeriodRecaps,
          weeks,
        }) => {
          console.log(
            `
            weeks:
${weeks.map(w => w.toFormattedString()).join('\n')}
            ---------------------
            ---------------------
           workingPeriods: 
${workingsPeriods.map(wp => `${wp.period.toFormattedString()}`).join('\n')}
            ---------------------
            ---------------------
           modulationDataWeeklyRecap: 
${modulationDataWeeklyRecaps.map(wr => wr.debug()).join('\n')}
            ---------------------
            ---------------------
           modulationDataWorkingPeriodRecap: 
${modulationDataWorkingPeriodRecaps.map(wpr => wpr.debug()).join('')}
            ---------------------
            ---------------------
           weeks: 
${weeks.map(w => w.toFormattedString()).join(' ')}
            ---------------------
            ---------------------`
          );
          return {
            workingsPeriods,
            modulationDataWeeklyRecaps,
            modulationDataWorkingPeriodRecaps,
            weeks,
          };
        }
      )
    );
  };

const findContracts = (contracts: List<EmploymentContract>) => week =>
  pipe(
    contracts.filter(c => {
      const endCappedContractRange = pipe(
        c.endDate,
        O.getOrElse(() => LocalDate.MAX),
        endDate => new LocalDateRange(c.startDate, endDate)
      );
      return endCappedContractRange.overlaps(week);
    }),
    E.fromNullable(new TimecardComputationError('Missing contract'))
  );

const findContract = (contracts: List<EmploymentContract>) => (workingPeriod: WorkingPeriod) =>
  pipe(
    contracts.find(c => c.id === workingPeriod.employmentContractId),
    E.fromNullable(new TimecardComputationError('Missing contract'))
  );

// const initializeWorkingPeriodTimecard = ({
//   shifts,
//   leaves,
//   contract,
//   workingPeriod,
//   employee,
// }: {
//   shifts: List<Shift>;
//   leaves: List<Leave>;
//   contract: EmploymentContract;
//   employee: Employee;
//   workingPeriod: WorkingPeriod;
// }) =>
//   WorkingPeriodTimecard.build({
//     contract,
//     employee,
//     workingPeriod,
//     weeklyPlanning: contract.weeklyPlannings.get(
//       workingPeriod.period,
//       Map<DayOfWeek, Set<LocalTimeSlot>>()
//     ),
//     shifts,
//     leaves,
//   });
//
// export const computeWorkingPeriodTimecard: (
//   workingPeriod: WorkingPeriod,
//   shifts: List<Shift>,
//   leaves: List<Leave>,
//   contract: EmploymentContract,
//   employee: Employee
// ) => WorkingPeriodTimecard = (workingPeriod, shifts, leaves, contract, employee) => {
//   return pipe(
//     {
//       contract,
//       employee,
//       workingPeriod,
//       shifts,
//       leaves,
//     },
//     initializeWorkingPeriodTimecard,
//     curateLeaves,
//     filterShifts,
//     generateInactiveShiftsIfPartialWeek,
//     computeTotalNormalHoursAvailable,
//     computeWorkedHours,
//     computeLeavesHours,
//     computeTotalAdditionalHours,
//     computeExtraHoursByRate,
//     computeSurchargedHours,
//     computeMealTickets,
//     inferTotalIntercontractAndTotalContract
//     // computeRentabilityForEmployee
//   );
// };
//
// export const computeTimecardForEmployee = (period: LocalDateRange) => {
//   return ({
//     employee,
//     shifts,
//     contracts,
//     leaves,
//   }: {
//     employee: Employee;
//     shifts: List<Shift>;
//     leaves: List<Leave>;
//     contracts: List<EmploymentContract>;
//   }) => {
//     if (contracts.isEmpty() && shifts.isEmpty()) {
//       return E.right({
//         period,
//         employee,
//         workingPeriods: List<WorkingPeriod>(),
//         groupedShifts: Map<WorkingPeriod, List<Shift>>(),
//         timecards: [] as WorkingPeriodTimecard[],
//         contracts,
//         weeklyRecaps: Map<LocalDateRange, WeeklyTimecardRecap>(),
//       });
//     }
//     return pipe(
//       E.Do,
//       E.bind('workingPeriods', () => splitPeriodIntoWorkingPeriods(contracts, period)),
//       E.bind('groupedShifts', ({ workingPeriods }) =>
//         groupShiftsByWorkingPeriods(shifts, workingPeriods)
//       ),
//       E.bind('groupedLeaves', ({ workingPeriods }) =>
//         groupLeavesByWorkingPeriods(leaves, workingPeriods)
//       ),
//       E.bind('timecards', ({ workingPeriods, groupedShifts, groupedLeaves }) =>
//         pipe(
//           workingPeriods.toArray(),
//           E.traverseArray(wp =>
//             pipe(
//               wp,
//               findContract(contracts),
//               E.map(({ contract, workingPeriod }) =>
//                 computeWorkingPeriodTimecard(
//                   workingPeriod,
//                   groupedShifts.get(workingPeriod, List<Shift>()),
//                   groupedLeaves.get(workingPeriod, List<Leave>()),
//                   contract,
//                   employee
//                 )
//               )
//             )
//           )
//         )
//       ),
//       E.bind('weeklyRecaps', ({ timecards }) =>
//         generateWeeklyTimecardRecap(List(timecards), employee, period)
//       ),
//       E.map(({ timecards, workingPeriods, groupedShifts, weeklyRecaps }) => ({
//         period,
//         employee,
//         workingPeriods,
//         groupedShifts,
//         timecards,
//         contracts,
//         weeklyRecaps,
//       })),
//       t => t
//     );
//   };
// };
