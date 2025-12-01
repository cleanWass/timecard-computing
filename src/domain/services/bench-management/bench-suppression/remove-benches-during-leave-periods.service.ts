import { Set } from 'immutable';
import { TimecardComputationResult } from '../../../../application/csv-generation/export-csv';

export const removeBenchesDuringLeavePeriodsService = (
  result: readonly TimecardComputationResult[]
) =>
  result.map(computationResult => {
    const leavePeriods = computationResult.timecards.flatMap(tc => tc.leavePeriods.toArray());
    const benches = computationResult.timecards.flatMap(tc => tc.benches.toArray());

    return {
      employee: computationResult.employee,
      benches: Set(benches)
        .filterNot(bench => bench.isExtraService())
        .filter(b => leavePeriods.some(lp => lp.period.contains(b.date))),
    };
  });
