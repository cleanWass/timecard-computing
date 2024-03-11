import { Duration } from '@js-joda/core';
import { List } from 'immutable';
import { WorkingPeriodTimecard } from '../../domain/models/time-card-computation/timecard/working-period-timecard';
import { headers } from '../../generate-csv-payroll';
import { formatDurationAs100 } from '../../~shared/util/joda-helper';
import { ExtractEitherRightType, keys } from '../../~shared/util/types';
import { computeTimecardForEmployee } from '../timecard-computation/compute-timecard-for-employee';

const formatObjectDurations = (rawObject: {
  [key in Exclude<
    (typeof headers)[number],
    'Matricule' | 'Fonction' | 'Salarié' | 'Période' | 'NbTicket' | 'Silae Id'
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

export const formatCsvGroupedByContract = (
  row: ExtractEitherRightType<ReturnType<typeof computeTimecardForEmployee>>
) => {
  const listTcs = List(row.timecards);
  const groupedTc = listTcs.groupBy(tc => tc.contract);
  return groupedTc
    .map((timecards, contract) => {
      const totalTcs = WorkingPeriodTimecard.getTotalWorkedHours(timecards);
      const totalMealTickets = WorkingPeriodTimecard.getTotalMealTickets(timecards);
      return {
        'Silae Id': row.employee.silaeId || '0',
        Salarié: row.employee.firstName + ' ' + row.employee.lastName || '0',
        Fonction: row.employee.role,
        Période: contract.period(row.period.end).toFormattedString(false),
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
    })
    .valueSeq();
};
