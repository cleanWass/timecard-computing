import { Duration } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import { Set } from 'immutable';
import { Bench } from '../../models/leave-recording/bench-recording/bench';
import { generateMissingBenchesService } from './bench-generation/generate-bench-affectations.service';
import { BenchAffectation, SlotToCreate } from './bench-generation/types';
import generateBenchManagementListService from './bench-management-list/generate-bench-management-list.service';
import { computeMatchingAffectationsListService } from './bench-matching-list/generate-bench-matching-list.service';
import { removeBenchesDuringLeavePeriodsService } from './bench-suppression/remove-benches-during-leave-periods.service';
import { removeExtraBenchesService } from './bench-suppression/remove-extra-benches.service.';

export const manageBenchesService = {
  generateMissingBenches: generateMissingBenchesService,
  removeExtraBenches: removeExtraBenchesService,
  computeMatchingAffectationsList: computeMatchingAffectationsListService,
  generateBenchManagementList: generateBenchManagementListService,
  removeBenchesDuringLeavePeriods: removeBenchesDuringLeavePeriodsService,

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
