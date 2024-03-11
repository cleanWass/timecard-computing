import { Duration, LocalDateTime } from '@js-joda/core';
import zod from 'zod';
import { ProspectiveShift } from '../../../domain/models/mission-delivery/shift/prospective-shift';

export const prospectiveShiftValidator = zod.object({
  // id: zod.string(),
  startTime: zod.string(),
  duration: zod.string(),
  employeeId: zod.string(),
  clientId: zod.string(),
  clientName: zod.string(),
});
// .transform(({ clientId, clientName, duration, employeeId, startTime }) =>
//   ProspectiveShift.build({
//     id: `ProspectiveShift-${ProspectiveShift.count++}`,
//     startTime: LocalDateTime.parse(startTime),
//     duration: Duration.parse(duration),
//     employeeId,
//     clientId,
//     clientName,
//   })
// );
