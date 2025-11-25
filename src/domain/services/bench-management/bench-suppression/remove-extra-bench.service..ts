import { pipe } from 'fp-ts/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as TE from 'fp-ts/TaskEither';
import { Set } from 'immutable';
import { TimecardComputationResult } from '../../../../application/csv-generation/export-csv';
import { Bench } from '../../../models/leave-recording/bench-recording/bench';

export const removeExtraBenchesService = (result: readonly TimecardComputationResult[]) => {
  return pipe(
    result,
    TE.traverseArray(computationResult => {
      return pipe(
        computationResult.timecards,
        TE.traverseArray(tc => {
          const benchesDeltaForPeriod = tc.workedHours.TotalIntercontract.minus(
            Bench.totalBenchesDuration(tc.benches)
          );
          return TE.right({
            week: tc.workingPeriod.period,
            delta: benchesDeltaForPeriod,
            benches: tc.benches
              .filter(({ date }) => tc.workingPeriod.period.contains(date))
              .filterNot(bench => bench.isExtraService()),
          });
        }),
        TE.map(RA.filter(({ delta }) => delta.isNegative())),
        TE.map(deltas => ({
          employee: computationResult.employee,
          weeksToReset: deltas.map(({ week }) => week),
          benches: Set(deltas).flatMap(({ benches }) => benches),
        }))
      );
    })
  );
};
