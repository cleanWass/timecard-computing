import { Duration } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as TE from 'fp-ts/TaskEither';
import { List, Set } from 'immutable';
import { TimecardComputationResult } from '../../../application/csv-generation/export-csv';
import { compact } from '../../../~shared/util/collections-helper';
import { Bench } from '../../models/leave-recording/bench-recording/bench';
import { LocalDateRange } from '../../models/local-date-range';
import { buildBenchAffectation } from './bench-generation/helper';
import { categorizeMatches, findBestMatches, generateCsvLine } from './bench-matching-list/hekper';
import {
  generateAffectationsForBenchesFromContractualPlanning,
  groupSameHoursSlots,
  mergeContinuousTimeSlots,
} from './helper';
import { BenchAffectation, SlotToCreate } from './types';

export const manageBenchAffectationService = {
  generateMissingBenches:
    ({ period }: { period: LocalDateRange }) =>
    (result: readonly TimecardComputationResult[]) => {
      return pipe(
        result,
        TE.traverseArray(computationResult => {
          const benchesToCreate = Set(computationResult.timecards).flatMap(tc => {
            return pipe(
              tc,
              generateAffectationsForBenchesFromContractualPlanning,
              mergeContinuousTimeSlots,
              groupSameHoursSlots,
              buildBenchAffectation(tc)
            );
          });

          return TE.right(benchesToCreate.toArray());
        }),
        TE.map(result => result.flat(1))
      );
    },

  removeExtraBenches: (result: readonly TimecardComputationResult[]) => {
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
  },

  computeMatchingAffectationsList: ({
    weeks,
    benchedEmployeesTimecard,
    activeEmployeesTimecard,
  }: {
    weeks: List<LocalDateRange>;
    benchedEmployeesTimecard: readonly TimecardComputationResult[];
    activeEmployeesTimecard: readonly TimecardComputationResult[];
  }) => {
    return weeks
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
      .join('\n');
  },

  filterNewAffectations: (
    affectations: Set<SlotToCreate>,
    existingBenches: Set<Bench>
  ): Set<SlotToCreate> =>
    affectations.filter(
      aff =>
        !existingBenches.some(
          bench => bench.date.equals(aff.date) && bench.timeslot.equals(aff.slot)
        )
    ),

  validateAffectation: (affectation: SlotToCreate): E.Either<Error, SlotToCreate> => {
    return E.right(affectation);
  },

  computeStatistics: (affectations: Set<BenchAffectation>) => ({
    totalCount: affectations.size,
    totalDuration: affectations.reduce((sum, aff) => sum.plus(aff.duration), Duration.ZERO),
  }),
};
