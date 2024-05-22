import { Duration } from '@js-joda/core';
import { List } from 'immutable';
import { Employee } from '../../domain/models/employee-registration/employee/employee';
import {
  EMPLOYEE_ROLE_TRANSLATIONS,
  EmployeeRole,
} from '../../domain/models/employee-registration/employee/EMPLOYEE_ROLE';
import { EmploymentContract } from '../../domain/models/employment-contract-management/employment-contract/employment-contract';
import { LocalDateRange } from '../../domain/models/local-date-range';
import { WorkingPeriodTimecard } from '../../domain/models/time-card-computation/timecard/working-period-timecard';
import { headers } from '../../generate-csv-payroll';
import { formatDuration, formatDurationAs100 } from '../../~shared/util/joda-helper';
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

export function formatCsv(row: ExtractEitherRightType<ReturnType<typeof computeTimecardForEmployee>>) {
  const listTcs = List(row.timecards);
  const groupedTc = listTcs.groupBy(tc => tc.contract);
  const totalTcs = WorkingPeriodTimecard.getTotalWorkedHours(listTcs);
  const totalMealTickets = WorkingPeriodTimecard.getTotalMealTickets(listTcs);
  return {
    'Silae Id': row.employee.silaeId || '0',
    Salarié: row.employee.firstName + ' ' + row.employee.lastName || '0',
    Fonction: row.employee.role,
    Période: row.period.toFormattedString(),
    'Durée hebdo': formatDuration(row.contracts.last()?.weeklyTotalWorkedHours || Duration.ZERO),
    Manager: row.employee.managerName || '',
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
    NbTicket: totalMealTickets === 0 ? '' : totalMealTickets,
  };
}

const getPeriodValue = (timecards: List<WorkingPeriodTimecard>, periodToCompute: LocalDateRange) => {
  const period = WorkingPeriodTimecard.getTotalWorkingPeriod(timecards);
  return (periodToCompute.commonRange(period) || period).toFormattedString(false);
};

export const getFunctionTranslations = (role: EmployeeRole) => EMPLOYEE_ROLE_TRANSLATIONS[role];

const getCsvOutput = (
  employee: Employee,
  period: LocalDateRange,
  timecards: List<WorkingPeriodTimecard>,
  contract: EmploymentContract
) => {
  const totalTcs = WorkingPeriodTimecard.getTotalWorkedHours(timecards);
  const totalMealTickets = WorkingPeriodTimecard.getTotalMealTickets(timecards);
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
    NbTicket: contract.isFullTime() ? '' : totalMealTickets,
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

export const formatCsvGroupedByContract = (
  row: ExtractEitherRightType<ReturnType<typeof computeTimecardForEmployee>>
) => {
  const listTcs = List(row.timecards);
  const groupedTc = listTcs
    .groupBy(tc => tc.contract)
    .map(timecards => timecards.sortBy(tc => tc.workingPeriod.period.start.toString()));

  return groupedTc.map((tcs, contract) => getCsvOutput(row.employee, row.period, tcs, contract)).valueSeq();
};
