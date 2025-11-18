import { Router } from 'express';
import { benchManagementUseCases } from '../../../application/use-cases/manage-benches/manage-benches.use-case';
import { EnvService } from '../../../config/env';
import { makeCareDataParserClient } from '../../../infrastructure/http/care-data-parser/care-cata-parser.client';
import { makeBenchManagementController } from '../controllers/bench-management.controller';
import { intercontractRequestSchema } from '../dto/bench.dto';
import { validateRequest } from '../middlewares/validation';

export const makeBenchManagementRoutes = () => {
  const router = Router();
  const careDataCareClient = makeCareDataParserClient({
    baseUrl: EnvService.get('CARE_DATA_PARSER_URL'),
    apiKey: EnvService.get('CARE_DATA_PARSER_API_KEY'),
  });

  const controller = makeBenchManagementController(benchManagementUseCases(careDataCareClient));

  router.post(
    '/intercontract/generation-data',
    validateRequest(intercontractRequestSchema),
    controller.generate
  );

  return router;
};
