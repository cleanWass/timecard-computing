import { Router } from 'express';
import { FileStoragePort } from '../../../application/ports/services/file-storage-port';
import { makeBenchManagementRoutes } from './benching-management.route';

export const makeRoutes = (dependencies: { s3Service: FileStoragePort }) => {
  const router = Router();

  // Monter toutes les routes
  // router.use(makeTimecardRoutes());
  // router.use(makeModulationRoutes());
  // router.use(makePayrollRoutes(dependencies.s3Service));
  router.use(makeBenchManagementRoutes());

  return router;
};
