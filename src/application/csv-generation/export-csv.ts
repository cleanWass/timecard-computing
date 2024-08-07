import { DayOfWeek, Duration, LocalDate, TemporalAdjusters } from '@js-joda/core';
import { pipe } from 'fp-ts/function';

import * as O from 'fp-ts/Option';
import { List, Map, OrderedMap, Set } from 'immutable';
import { Employee } from '../../domain/models/employee-registration/employee/employee';

import {
  EMPLOYEE_ROLE_TRANSLATIONS,
  EmployeeRole,
} from '../../domain/models/employee-registration/employee/employee-role';
import { EmploymentContract } from '../../domain/models/employment-contract-management/employment-contract/employment-contract';
import { LocalDateRange } from '../../domain/models/local-date-range';
import { WorkingPeriodTimecard } from '../../domain/models/time-card-computation/timecard/working-period-timecard';
import { formatDurationAs100, getFirstDayOfWeek } from '../../~shared/util/joda-helper';
import { ExtractEitherRightType, keys } from '../../~shared/util/types';
import { computeTimecardForEmployee } from '../timecard-computation/compute-timecard-for-employee';
import { DayHeaders, DoneDayHeaders, PlanningDayHeaders, WorkedHoursHeaders } from './headers';
import { prepareEnv } from './prepare-env';

const formatObjectDurations = (rawObject: { [key in (typeof WorkedHoursHeaders)[number]]: Duration }) =>
  keys(rawObject).reduce((res, code) => {
    const value = Math.round(((rawObject[code] || Duration.ZERO).toMinutes() / 15) * 15);
    const durationAs100 = formatDurationAs100(Duration.ofMinutes(value), '');
    return { ...res, [code]: durationAs100 === '0' ? '' : durationAs100 };
  }, {});

export type TimecardComputationResult = ExtractEitherRightType<ReturnType<typeof computeTimecardForEmployee>>;

const generateDayData = (headers: ReadonlyArray<string>, dayDataGetter: (day: DayOfWeek, index: number) => string) =>
  headers.reduce(
    (acc, day, index) => ({ ...acc, [day]: dayDataGetter(DayOfWeek.values()[index], index) }),
    {} as { [k in (typeof DayHeaders)[number]]: 'x' | '' }
  );

export function formatCsv(row: TimecardComputationResult) {
  const timecards = List(row.timecards);
  return getCsvOutput(row.employee, WorkingPeriodTimecard.getTotalWorkingPeriod(timecards), timecards);
}

export const formatCsvDetails = (row: TimecardComputationResult) => {
  return row.timecards.map(timecard => {
    const { contract, employee, workingPeriod, workedHours } = timecard;

    const ref = generateDayData(PlanningDayHeaders, (day, index) => {
      const slots = timecard.weeklyPlanning.get(day);
      return formatDurationAs100(
        slots?.reduce((acc, slot) => acc.plus(slot.duration()), Duration.ZERO) || Duration.ZERO
      );
    });

    const workedDays = generateDayData(DayHeaders, (day, index) => {
      const date = workingPeriod.period.start.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).plusDays(index);
      return workingPeriod.period.contains(date) ? 'x' : '';
    });

    const shifts = generateDayData(DoneDayHeaders, (day, index) => {
      const date = workingPeriod.period.start.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).plusDays(index);
      const slots = timecard.shifts.filter(shift => shift.startTime.toLocalDate().isEqual(date));
      return formatDurationAs100(slots?.reduce((acc, slot) => acc.plus(slot.duration), Duration.ZERO) || Duration.ZERO);
    });

    return {
      'Silae Id': employee.silaeId || '0',
      Salarié: employee.firstName + ' ' + employee.lastName || '0',
      Fonction: getFunctionTranslations(employee.role),
      Période: workingPeriod.period.toFormattedString(),
      Manager: employee.managerName,
      'Durée hebdo': `${formatDurationAs100(contract?.weeklyTotalWorkedHours || Duration.ZERO)}h`,
      Contrat: `${contract?.initialId} | ${contract?.type} | ${contract?.subType} | ${formatDurationAs100(
        contract?.extraDuration || Duration.ZERO
      )}`,
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

export const formatCsvWeekly = (row: TimecardComputationResult) => {
  const timecards = List(row.timecards);
  return timecards
    .groupBy(tc => getFirstDayOfWeek(tc.workingPeriod.period.start).toString())
    .map(tcs => getCsvOutput(row.employee, WorkingPeriodTimecard.getTotalWorkingPeriod(tcs), tcs))
    .valueSeq()
    .toArray();
};

const getCsvOutput = (
  employee: Employee,
  period: LocalDateRange,
  timecards: List<WorkingPeriodTimecard>,
  contract?: EmploymentContract,
  contractInfo = false
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
    ...(contractInfo
      ? {
          'Durée hebdo': `${formatDurationAs100(contract?.weeklyTotalWorkedHours || Duration.ZERO)}h`,
          Contrat: `${contract?.initialId} | ${contract?.type} | ${contract?.subType} | ${formatDurationAs100(
            contract?.extraDuration || Duration.ZERO
          )}`,
        }
      : {}),
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

export const formatCsvSilaeExport = (
  row: TimecardComputationResult,
  logger: ReturnType<typeof prepareEnv>['log']['logger']
) => {
  const listTcs = List(row.timecards);
  const contracts = row.contracts.sortBy(contract => contract.startDate.toString());
  const test = contracts.reduce((groupedContracts, contract, index, te) => {
    logger('---------------------------');
    logger(
      'groupedContracts : ' +
        JSON.stringify(
          groupedContracts.map(cs => cs.map(c => c.initialId).join(', ')),
          null,
          2
        )
    );
    logger('contract : ' + contract.type + ' ' + contract.subType + ' ' + contract.initialId);
    // cas ou map vide
    if (groupedContracts.size === 0) {
      logger('cas ou map vide');
      return groupedContracts.set(Set([contract.initialId]), List([contract]));
    }

    const lastContractAdded = groupedContracts?.last()?.last();
    const lastEntryKey = groupedContracts.keySeq().last() || Set();
    const previousContractsList = groupedContracts.get(lastEntryKey) || List();

    const isContractContiguousWithPreviousContract = O.getOrElse(() => contract.startDate)(lastContractAdded!.endDate)
      .plusDays(1)
      .isAfter(contract.startDate);

    if (
      groupedContracts.size === 1 &&
      previousContractsList.every(c => c.subType === 'complement_heure') &&
      lastContractAdded?.type === 'CDI' &&
      lastContractAdded.subType === 'complement_heure' &&
      contract.type === 'CDI' &&
      isContractContiguousWithPreviousContract
    ) {
      logger('cas complement heure + CDI + continu');
      return groupedContracts
        .delete(lastEntryKey)
        .set(Set(lastEntryKey.add(contract.initialId)), previousContractsList.concat(contract));
    }

    // cas ou un contrat avec le meme initialId est deja present
    const findKey = groupedContracts.findKey((_, initialIds) => initialIds.has(contract.initialId));
    if (findKey) {
      logger('cas ou un contrat avec le meme initialId est deja present');
      return groupedContracts.update(findKey, contracts => contracts?.push(contract));
    }

    // cas ou c'est un complément d'heure
    if (contract.subType === 'complement_heure') {
      logger('cas ou c est un complement d heure');
      return groupedContracts
        .delete(lastEntryKey || Set(['']))
        .set(
          lastEntryKey?.add(contract.initialId) || Set([contract.initialId]),
          previousContractsList.concat(contract)
        );
    }
    if (
      contract.type === 'CDI' &&
      lastContractAdded &&
      lastContractAdded.weeklyTotalWorkedHours.equals(contract.weeklyTotalWorkedHours) &&
      isContractContiguousWithPreviousContract
    ) {
      logger('cas ou c est un CDI et que les heures sont les memes');
      return groupedContracts
        .delete(lastEntryKey || Set(['']))
        .set(lastEntryKey.add(contract.initialId) || Set([contract.initialId]), previousContractsList.concat(contract));
    }

    logger('cas default');
    return groupedContracts.set(Set([contract.initialId]), List([contract]));
  }, OrderedMap<Set<string>, List<EmploymentContract>>());

  const res = test
    .keySeq()
    .toList()
    .map(initialIds => listTcs.filter(tc => initialIds.has(tc.contract.initialId)));

  const groupedTc = listTcs
    .groupBy(tc => tc.contract.initialId)
    .map(timecards => timecards.sortBy(tc => tc.workingPeriod.period.start.toString()));

  logger(
    'result  -->  ' +
      JSON.stringify(
        res.map((tcs, contract) => getCsvOutput(row.employee, row.period, tcs, tcs.first()?.contract, true)).valueSeq(),
        null,
        2
      )
  );
  logger('=======RESULT========');
  logger(
    JSON.stringify(
      res.toArray().map(tcs => tcs.map(tc => tc.contract.initialId).join(', ')),
      null,
      2
    )
  );
  return res
    .map(tcs => getCsvOutput(row.employee, row.period, tcs, tcs.first()?.contract, true))
    .valueSeq()
    .toArray();
};
