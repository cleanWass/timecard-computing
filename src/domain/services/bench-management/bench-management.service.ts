import { Duration } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import { Set } from 'immutable';
import { Bench } from '../../models/leave-recording/bench-recording/bench';
import { generateMissingBenches } from './bench-generation/generate-bench-affectations';
import { BenchAffectation, SlotToCreate } from './bench-generation/types';
import { computeMatchingAffectationsList } from './bench-matching-list/generate-bench-matching-list';
import { removeExtraBenches } from './bench-suppression/remove-extra-bench';

export const manageBenchAffectationService = {
  generateMissingBenches,
  removeExtraBenches,
  computeMatchingAffectationsList,

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
