import { pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { Set } from 'immutable';
import { TimecardComputationResult } from '../../../../application/csv-generation/export-csv';
import { LocalDateRange } from '../../../models/local-date-range';
import {
  buildBenchAffectation,
  generateAffectationsForBenchesFromContractualPlanning,
  groupSameHoursSlots,
  mergeContinuousTimeSlots,
} from './helper';

export const generateMissingBenchesService =
  ({ period }: { period: LocalDateRange }) =>
  (result: readonly TimecardComputationResult[]) => {
    return pipe(
      result,
      TE.traverseArray(computationResult => {
        const benchesToCreate = Set(computationResult.timecards).flatMap(tc =>
          pipe(
            tc,
            generateAffectationsForBenchesFromContractualPlanning,
            mergeContinuousTimeSlots,
            groupSameHoursSlots,
            buildBenchAffectation(tc)
          )
        );

        return TE.right(benchesToCreate.toArray());
      }),
      TE.map(result => result.flat(1))
    );
  };
