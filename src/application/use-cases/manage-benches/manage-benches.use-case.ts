import { CareDataParserClient } from '../../ports/services/care-data-parser-client';
import { makeCreateMissingBenchesUseCase } from './make-create-missing-benches.use-case';
import { makeGenerateBenchManagementListUseCase } from './make-generate-bench-management-list.use-case';
import { makeGenerateMatchingBenchesListUseCase } from './make-generate-matching-benches-list.use-case';
import { makeRemoveBenchesDuringLeavePeriodsUseCase } from './make-remove-benches-during-leave-periods.use-case';
import { makeRemoveExtraBenchesUseCase } from './make-remove-extra-benches.use-case';

export const benchManagementUseCases = (careDataParserClient: CareDataParserClient) => ({
  generateMissingBenches: makeCreateMissingBenchesUseCase(careDataParserClient),
  removeExtraBenches: makeRemoveExtraBenchesUseCase(careDataParserClient),
  computeBenchesMatchingShiftsList: makeGenerateMatchingBenchesListUseCase(careDataParserClient),
  makeGenerateBenchManagementListUseCase:
    makeGenerateBenchManagementListUseCase(careDataParserClient),
  makeRemoveBenchesDuringLeavePeriodsUseCase:
    makeRemoveBenchesDuringLeavePeriodsUseCase(careDataParserClient),
});

export type BenchManagementUseCases = ReturnType<typeof benchManagementUseCases>;
