import { Router } from 'express';
import { S3Service } from '../../../infrastructure/storage/s3/s3.service';
import { makeIntercontractRoutes } from './benching-management.route';

export const makeRoutes = (dependencies: { s3Service: S3Service }) => {
  const router = Router();

  // Monter toutes les routes
  // router.use(makeTimecardRoutes());
  // router.use(makeModulationRoutes());
  // router.use(makePayrollRoutes(dependencies.s3Service));
  router.use(makeIntercontractRoutes());

  return router;
};
