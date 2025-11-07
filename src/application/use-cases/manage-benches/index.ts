import { CareDataParserClient } from '../../ports/services/care-data-parser-client';
import { makeCreateMissingBenchesUseCase } from './make-create-missing-benches.use-case';
import { makeTerminateExcessiveBenchesUseCase } from './make-remove-excessive-benches.use-case';

export const benchManagementUseCases = (careDataParserClient: CareDataParserClient) => ({
  benchGenerationUseCase: makeCreateMissingBenchesUseCase(careDataParserClient),
  benchSuppressionUseCase: makeTerminateExcessiveBenchesUseCase(careDataParserClient),
});

export type BenchManagementUseCases = ReturnType<typeof benchManagementUseCases>;
