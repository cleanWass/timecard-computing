import { DayOfWeek, Duration, TemporalAdjusters } from '@js-joda/core';
import { List, Set } from 'immutable';
import { Employee } from '../../domain/models/employee-registration/employee/employee';
import {
  EMPLOYEE_ROLE_TRANSLATIONS,
  EmployeeRole,
} from '../../domain/models/employee-registration/employee/EMPLOYEE_ROLE';
import { EmploymentContract } from '../../domain/models/employment-contract-management/employment-contract/employment-contract';
import { LocalDateRange } from '../../domain/models/local-date-range';
import { WorkingPeriodTimecard } from '../../domain/models/time-card-computation/timecard/working-period-timecard';
import { headers } from '../../generate-csv-payroll';
import { formatDuration, formatDurationAs100, getTotalDuration } from '../../~shared/util/joda-helper';
import { ExtractEitherRightType, keys } from '../../~shared/util/types';
import { computeTimecardForEmployee } from '../timecard-computation/compute-timecard-for-employee';

const formatObjectDurations = (rawObject: {
  [key in Exclude<
    (typeof headers)[number],
    'Matricule' | 'Fonction' | 'Salarié' | 'Période' | 'NbTicket' | 'Silae Id' | 'Manager'
  >]: Duration;
}) =>
  keys(rawObject).reduce((res, code) => {
    const value = Math.round(((rawObject[code] || Duration.ZERO).toMinutes() / 15) * 15);
    const durationAs100 = formatDurationAs100(Duration.ofMinutes(value));
    return { ...res, [code]: durationAs100 === '0' ? '' : durationAs100 };
  }, {});

type TimecardComputationResult = ExtractEitherRightType<ReturnType<typeof computeTimecardForEmployee>>;

export function formatCsv(row: TimecardComputationResult) {
  const timecards = List(row.timecards);
  return getCsvOutput(row.employee, WorkingPeriodTimecard.getTotalWorkingPeriod(timecards), timecards);
}

export const formatCsvDetails = (row: TimecardComputationResult) => {
  return row.timecards.map(timecard => {
    const { contract, employee, workingPeriod, workedHours } = timecard;
    const days = ['L', 'Ma', 'Me', 'J', 'V', 'S', 'D'] as const;
    const workedDays = days.reduce(
      (acc, day, index) => ({
        ...acc,
        [`  ${day}`]: workingPeriod.period.contains(
          workingPeriod.period.start.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).plusDays(index)
        )
          ? 'x'
          : '',
      }),
      {} as { [k in (typeof days)[number]]: 'x' | '' }
    );
    const ref = days.reduce(
      (acc, day, index) => {
        const slots = timecard.weeklyPlanning.get(DayOfWeek.values()[index]);
        return {
          ...acc,
          [`R ${day}`]: formatDurationAs100(
            slots?.reduce((acc, slot) => acc.plus(slot.duration()), Duration.ZERO) || Duration.ZERO
          ),
        };
      },
      {} as { [k in (typeof days)[number]]: 'x' | '' }
    );

    const shifts = days.reduce(
      (acc, day, index) => {
        const date = workingPeriod.period.start
          .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
          .plusDays(index);
        const slots = timecard.shifts.filter(shift => shift.startTime.toLocalDate().isEqual(date));
        return {
          ...acc,
          [`S ${day}`]: formatDurationAs100(
            slots?.reduce((acc, slot) => acc.plus(slot.duration), Duration.ZERO) || Duration.ZERO
          ),
        };
      },
      {} as { [k in (typeof days)[number]]: 'x' | '' }
    );
    return {
      'Silae Id': employee.silaeId || '0',
      Salarié: employee.firstName + ' ' + employee.lastName || '0',
      Fonction: getFunctionTranslations(employee.role),
      Période: workingPeriod.period.toFormattedString(),
      Manager: employee.managerName,
      ...workedDays,
      ...ref,
      ...shifts,

      ...formatObjectDurations({
        HN: workedHours.TotalNormal,
        HC10: workedHours.TenPercentRateComplementary,
        HC11: workedHours.ElevenPercentRateComplementary,
        HC25: workedHours.TwentyFivePercentRateComplementary,
        HS25: workedHours.TwentyFivePercentRateSupplementary,
        HS50: workedHours.FiftyPercentRateSupplementary,
        HNuit: workedHours.NightShiftContract,
        MajoNuit100: workedHours.NightShiftAdditional,
        HDim: workedHours.SundayContract,
        MajoDim100: workedHours.SundayAdditional,
      }),
      NbTicket: contract?.isFullTime() ? '' : timecard.mealTickets,
    };
  });
};

const getPeriodValue = (timecards: List<WorkingPeriodTimecard>, periodToCompute: LocalDateRange) => {
  const period = WorkingPeriodTimecard.getTotalWorkingPeriod(timecards);
  return (periodToCompute.commonRange(period) || period).toFormattedString(false);
};

export const getFunctionTranslations = (role: EmployeeRole) => EMPLOYEE_ROLE_TRANSLATIONS[role];

const getCsvOutput = (
  employee: Employee,
  period: LocalDateRange,
  timecards: List<WorkingPeriodTimecard>,
  contract?: EmploymentContract
) => {
  const totalTcs = WorkingPeriodTimecard.getTotalWorkedHours(timecards);
  const totalMealTickets = WorkingPeriodTimecard.getTotalMealTickets(timecards);
  const nbTicket = contract?.isFullTime() ? '' : totalMealTickets;
  return {
    'Silae Id': employee.silaeId || '0',
    Salarié: employee.firstName + ' ' + employee.lastName || '0',
    Fonction: getFunctionTranslations(employee.role),
    Période: getPeriodValue(timecards, period),
    Manager: employee.managerName,
    ...formatObjectDurations({
      HN: totalTcs.TotalNormal,
      HC10: totalTcs.TenPercentRateComplementary,
      HC11: totalTcs.ElevenPercentRateComplementary,
      HC25: totalTcs.TwentyFivePercentRateComplementary,
      HS25: totalTcs.TwentyFivePercentRateSupplementary,
      HS50: totalTcs.FiftyPercentRateSupplementary,
      HNuit: totalTcs.NightShiftContract,
      MajoNuit100: totalTcs.NightShiftAdditional,
      HDim: totalTcs.SundayContract,
      MajoDim100: totalTcs.SundayAdditional,
    }),
    NbTicket: nbTicket,
  };
};

export const timecardGroupper = (contracts: List<EmploymentContract>) => {
  // }: ExtractEitherRightType<ReturnType<typeof computeTimecardForEmployee>>) => {
  // console.log(
  //   `${contracts.size} contract${contracts.size > 1 ? 's' : ''}`,
  //   contracts.map(c => c.debug()).join('-------')
  // );
  const test = contracts.reduce((groupedContracts, contract) => {
    return groupedContracts;
  }, List<List<EmploymentContract>>());

  return contracts;
};

export const formatCsvGroupedByContract = (row: TimecardComputationResult) => {
  const listTcs = List(row.timecards);
  const groupedTc = listTcs
    .groupBy(tc => tc.contract)
    .map(timecards => timecards.sortBy(tc => tc.workingPeriod.period.start.toString()));

  return groupedTc.map((tcs, contract) => getCsvOutput(row.employee, row.period, tcs, contract)).valueSeq();
};
