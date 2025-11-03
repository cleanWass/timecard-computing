import { Request, Response } from 'express';
import { handleTimecardComputationRoute } from '../../../infrastructure/route/timecard-computation-route';

export const makeTimecardController = () => ({
  compute: async (req: Request, res: Response) => {
    await handleTimecardComputationRoute(req, res)();
  },
});
