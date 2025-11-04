import { Router } from 'express';
import { makeCreateMissingBenchesUseCase } from '../../../application/use-cases/manage-benches/make-create-missing-benches.use-case';
import { makeTerminateExcessiveBenchesUseCase } from '../../../application/use-cases/manage-benches/make-terminate-excessive-benches.use-case';
import { EnvService } from '../../../config/env';
import { makeCareDataParserClient } from '../../../infrastructure/http/care-data-parser/care-cata-parser.client';
import { makeBenchManagementController } from '../controllers/bench-management.controller';
import { intercontractRequestSchema } from '../dto/bench.dto';
import { validateRequest } from '../middlewares/validation';

export const makeIntercontractRoutes = () => {
  const router = Router();
  const careDataCareClient = makeCareDataParserClient({
    baseUrl: EnvService.get('CARE_DATA_PARSER_URL'),
    apiKey: EnvService.get('CARE_DATA_PARSER_API_KEY'),
  });
  const useCase = makeCreateMissingBenchesUseCase(careDataCareClient);
  const useCase2 = makeTerminateExcessiveBenchesUseCase(careDataCareClient);
  const controller = makeBenchManagementController(useCase, useCase2);

  router.post(
    '/intercontract/generation-data',
    validateRequest(intercontractRequestSchema),
    controller.generate
  );

  return router;
};
