import { DayOfWeek, Duration } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { List, Map, Set } from 'immutable';
import { TimecardComputationResult } from '../../../application/csv-generation/export-csv';
import { Bench } from '../../models/leave-recording/bench-recording/bench';
import { LocalDateRange } from '../../models/local-date-range';
import {
  generateAffectationsForBenchesFromContractualPlanning,
  groupSameHoursSlots,
  logBenchAffectations,
  mergeContinuousTimeSlots,
} from './helper';
import { SlotToCreate } from './types';

export const generateSlotToCreatesService = {
  generateIntercontract:
    ({ period }: { period: LocalDateRange }) =>
    (result: TimecardComputationResult[]) => {
      let slotsToCreate = Map<string, Set<SlotToCreate>>();
      return pipe(
        result,
        TE.traverseArray(computationResult => {
          const unregisteredBenches = computationResult.timecards.reduce(
            (acc, tc) =>
              acc.set(
                tc.workingPeriod.period,
                pipe(
                  tc,
                  generateAffectationsForBenchesFromContractualPlanning,
                  mergeContinuousTimeSlots,
                  slots => {
                    slotsToCreate = slotsToCreate.update(
                      computationResult.employee.silaeId,
                      Set<SlotToCreate>(),
                      s => s?.union(slots)
                    );
                    return slots;
                  },
                  groupSameHoursSlots
                )
              ),
            Map<LocalDateRange, Map<Set<DayOfWeek>, Set<SlotToCreate>>>()
          );

          logBenchAffectations(
            slotsToCreate.get(computationResult.employee.silaeId)?.size || 0,
            unregisteredBenches,
            computationResult.employee
          );

          return TE.right({
            employee: computationResult.employee,
            timecards: computationResult.timecards,
            benches: List(computationResult.timecards.flatMap(tc => tc.benches.toArray())),
            weeklyRecaps: computationResult.weeklyRecaps,
            workingPeriods: computationResult.workingPeriods,
            period,
            benchesToCreate:
              slotsToCreate.get(computationResult.employee.silaeId) || Set<SlotToCreate>(),
          });
        })
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

  computeStatistics: (affectations: Set<SlotToCreate>) => ({
    totalCount: affectations.size,
    totalDuration: affectations.reduce((sum, aff) => sum.plus(aff.duration), Duration.ZERO),
    byDate: affectations.groupBy(aff => aff.date.toString()).map(affs => affs.size),
  }),
};
