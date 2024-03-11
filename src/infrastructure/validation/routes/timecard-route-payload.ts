import zod from 'zod';
import { prospectiveShiftValidator } from '../extern/prospective-shift';
import { closedPeriodValidator } from '../extern/temporals';

export const timecardRoutesPayloadValidator = zod.object({
  period: closedPeriodValidator,
  silaeId: zod.string(),
  prospectiveShifts: zod.array(prospectiveShiftValidator),
});

export type TimecardRoutePayloadValidatorType = zod.infer<typeof timecardRoutesPayloadValidator>;
