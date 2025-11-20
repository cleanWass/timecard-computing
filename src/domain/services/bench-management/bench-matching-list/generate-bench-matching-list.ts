import { List } from 'immutable';
import { TimecardComputationResult } from '../../../../application/csv-generation/export-csv';
import { compact } from '../../../../~shared/util/collections-helper';
import { LocalDateRange } from '../../../models/local-date-range';
import { categorizeMatches, findBestMatches, generateCsvLine } from './helper';

export const computeMatchingAffectationsList = ({
  weeks,
  benchedEmployeesTimecard,
  activeEmployeesTimecard,
}: {
  weeks: List<LocalDateRange>;
  benchedEmployeesTimecard: readonly TimecardComputationResult[];
  activeEmployeesTimecard: readonly TimecardComputationResult[];
}) => {
  const headersLine = [
    'Silae Id',
    'Nom',
    'Prénom',
    'Lun',
    'Mar',
    'Mer',
    'Jeu',
    'Ven',
    'Sam',
    'Dim',
  ].join(',');

  return `${headersLine}\n${weeks
    .map(week => {
      const benchedRecaps = List(
        compact(
          benchedEmployeesTimecard.map(data =>
            data.weeklyRecaps.find(recap => recap.week.equals(week))
          )
        )
      );

      const activeRecaps = List(
        compact(
          activeEmployeesTimecard.map(data =>
            data.weeklyRecaps.find(recap => recap.week.equals(week))
          )
        )
      );

      return benchedRecaps
        .map(benchedRecap => {
          const benchSchedule = benchedRecap.workingPeriodTimecards
            .flatMap(tc => tc.benches)
            .groupBy(b => b.date.dayOfWeek());

          const matches = findBestMatches(benchSchedule, activeRecaps);

          const categorizedMatches = categorizeMatches(matches);

          return generateCsvLine(benchedRecap.employee, benchSchedule, categorizedMatches);
        })
        .join('\n');
    })
    .join('\n')}`;
};
