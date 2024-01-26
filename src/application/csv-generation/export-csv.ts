import { Duration } from '@js-joda/core';
import { List } from 'immutable';
import { HoursTypeCodes } from '../../domain/models/time-card-computation/timecard/worked-hours-rate';
import { WorkingPeriodTimecard } from '../../domain/models/time-card-computation/timecard/working-period-timecard';
import { formatDurationAs100 } from '../../~shared/util/joda-helper';
import { ExtractEitherRightType, keys } from '../../~shared/util/types';
import { computeTimecardForEmployee } from '../timecard-computation/compute-timecard-for-employee';

function formatObjectDurations(rawObject: { [key in Exclude<(typeof headers)[number], 'Matricule' | 'Salarié' | 'Période'>]: Duration }) {
  return keys(rawObject).reduce((res, code) => {
    return { ...res, [code]: formatDurationAs100(rawObject[HoursTypeCodes[code]]) || '0' };
  }, {});
}

export function formatCsv(row: ExtractEitherRightType<ReturnType<typeof computeTimecardForEmployee>>) {
  const listTcs = List(row.timecards);
  const groupedTc = listTcs.groupBy(tc => tc.contract);
  const totalTcs = WorkingPeriodTimecard.getTotal(listTcs);

  return {
    Matricule: row.employee.id || '0',
    Salarié: row.employee.firstName + ' ' + row.employee.lastName || '0',
    Période: row.contracts.first().period(row.period.end).toFormattedString(),
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
  };
}
