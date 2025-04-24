import { DayOfWeek, Duration, LocalDate } from '@js-joda/core';
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
import {
  MODULATED_FULL_TIME_DURATION,
  ModulationDataWorkingPeriodCard,
} from '../../domain/models/modulation-data/modulation-data-working-period-card';
import { WorkedHoursRecap } from '../../domain/models/time-card-computation/timecard/worked-hours-rate';
import { WorkingPeriod } from '../../domain/models/time-card-computation/working-period/working-period';
import { TimecardComputationError } from '../../~shared/error/TimecardComputationError';
import { sequenceList } from '../../~shared/util/sequence-list';
import { computeWorkingPeriods } from '../timecard-computation/computation/working-period-computation';
import {
  computeModulationLeavesHours,
  computeModulationWorkedHours,
} from './computation/base-hours-computation';

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

const computeSurchargedHoursPool = (wpc: ModulationDataWorkingPeriodCard) => {
  const contract = wpc.contract;
  if (contract.isFullTime())
    return wpc.addSurchargedHoursToPool(
      'TwentyFivePercentRateSupplementary',
      Duration.ofMinutes(
        Math.ceil(
          (Duration.ofHours(8).toMinutes() / MODULATED_FULL_TIME_DURATION.toMinutes()) *
            wpc.getModulatedInProportionWorkingTime().toMinutes()
        )
      )
    );
  // MIGHT NOT BE NECESSARY : no extra hours for modulation according to RH
  if (contract.isExtraHours()) {
    return wpc.addSurchargedHoursToPool(
      'TenPercentRateComplementary',
      Duration.ofMinutes(
        ((contract.extraDuration || Duration.ZERO)?.toMinutes() /
          contract.weeklyTotalWorkedHours.toMinutes()) *
          wpc.getModulatedInProportionWorkingTime().toMinutes()
      ) || Duration.ZERO
    );
  }
  return wpc.with({
    surchargedHoursPool: wpc.surchargedHoursPool.set(
      'ElevenPercentRateComplementary',
      Duration.ofMinutes(Math.ceil(wpc.getModulatedInProportionWorkingTime().toMinutes() * 0.1))
    ),
  });
};

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
                  computeSurchargedHoursPool,
                  computeModulationWorkedHours,
                  computeModulationLeavesHours
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
      E.bind(
        'modulationDataRecaps',
        ({
          weeks,
          workingsPeriods,
          modulationDataWorkingPeriodRecaps,
          modulationDataWeeklyRecaps,
        }) =>
          E.right(
            ModulationDataRecap.build({
              employmentContracts: contracts,
              modulationDataWeeklyCards: modulationDataWeeklyRecaps,
              modulationDataWorkingPeriodCards: modulationDataWorkingPeriodRecaps,
              modulationDataMonthlyCards: List<ModulationDataMonthlyCard>(),
              period: period,
              workingPeriods: List<WorkingPeriod>(),
              employee,
            })
          )
      ),
      E.map(
        ({
          workingsPeriods,
          modulationDataRecaps,
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
${workingsPeriods
  .sort((a, b) => a.period.start.compareTo(b.period.start))
  .map(wp => `${wp.period.toFormattedString()}`)
  .join('\n')}
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
           modulationDataRecaps: 
${modulationDataRecaps.debug()}
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
