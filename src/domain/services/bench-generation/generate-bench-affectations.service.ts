import { DayOfWeek, Duration, LocalTime } from '@js-joda/core';
import { toArray } from 'fp-ts/Map';
import * as RA from 'fp-ts/ReadonlyArray';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { List, Map, Set } from 'immutable';
import { TimecardComputationResult } from '../../../application/csv-generation/export-csv';
import { Employee } from '../../models/employee-registration/employee/employee';
import { Bench } from '../../models/leave-recording/bench-recording/bench';
import { LeavePeriod } from '../../models/leave-recording/leave/leave-period';
import { LocalDateRange } from '../../models/local-date-range';
import { LocalTimeSlot } from '../../models/local-time-slot';
import { WorkingPeriodTimecard } from '../../models/timecard-computation/timecard/working-period-timecard';
import {
  checkIfDuringLeavePeriod,
  generateAffectationsForBenchesFromContractualPlanning,
  groupSameHoursSlots,
  logBenchAffectations,
  mergeContinuousTimeSlots,
} from './helper';
import { BenchAffectation, SlotToCreate } from './types';

const buildBenchAffectation =
  (timecard: WorkingPeriodTimecard) =>
  (groupedByDaysSlots: Map<Set<DayOfWeek>, Set<SlotToCreate>>) =>
    groupedByDaysSlots
      .map(
        (slots, days) =>
          ({
            slot: slots.first()?.slot || new LocalTimeSlot(LocalTime.MIN, LocalTime.MIN),
            days,
            duration: slots.first()?.duration || Duration.ZERO,
            period: timecard.workingPeriod.period,
            employee: timecard.employee,
            isDuringLeavePeriod: slots.some(sl => sl.isDuringLeavePeriod),
          }) satisfies BenchAffectation
      )
      .toSet();

export const generateSlotToCreatesService = {
  generateMissingBenches:
    ({ period }: { period: LocalDateRange }) =>
    (result: readonly TimecardComputationResult[]) => {
      return pipe(
        result,
        TE.traverseArray(computationResult => {
          const benchesToCreate = Set(computationResult.timecards).flatMap(tc => {
            console.log(tc.debug());
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

  terminateExcessiveBenches: (result: readonly TimecardComputationResult[]) => {
    return pipe(
      result,
      TE.traverseArray(computationResult =>
        pipe(
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
          TE.map(deltas => {
            console.log(`${deltas.map(({ week }) => week).map(w => w.toFormattedString())}`);
            console.log(
              `Benches to terminate: ${Set(deltas)
                .flatMap(({ benches }) => benches)
                .map(b => b.affectationId + ' ' + b.client.name)}`
            );
            return {
              employee: computationResult.employee,
              weeksToReset: deltas.map(({ week }) => week),
              benches: Set(deltas).flatMap(({ benches }) => benches),
            };
          })
        )
      )
    );
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
