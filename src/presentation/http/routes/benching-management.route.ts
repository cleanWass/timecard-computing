import { Router } from 'express';
import { makeManageIntercontractUseCase } from '../../../application/use-cases/manage-intercontract/manage-intercontract.use-case';
import { EnvService } from '../../../config/env';
import { makeCareDataParserClient } from '../../../infrastructure/http/care-data-parser/care-cata-parser.client';
import { makeIntercontractController } from '../controllers/bench-management.controller';
import { intercontractRequestSchema } from '../dto/bench.dto';
import { validateRequest } from '../middlewares/validation';

export const makeIntercontractRoutes = () => {
  const router = Router();
  const careDataCareClient = makeCareDataParserClient({
    baseUrl: EnvService.get('CARE_DATA_PARSER_URL'),
    apiKey: EnvService.get('CARE_DATA_PARSER_API_KEY'),
  });
  const useCase = makeManageIntercontractUseCase(careDataCareClient);
  const controller = makeIntercontractController(useCase);

  router.post(
    '/intercontract/generation-data',
    validateRequest(intercontractRequestSchema),
    controller.generate
  );

  return router;
};
