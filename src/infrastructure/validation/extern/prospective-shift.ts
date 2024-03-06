import { Duration, LocalDateTime } from '@js-joda/core';
import zod from 'zod';
import { ProspectiveShift } from '../../../domain/models/mission-delivery/shift/prospective-shift';

export const prospectiveShiftValidator = zod
  .object({
    id: zod.string(),
    date: zod.string().min(1),
    type: zod.string(),
    employeeId: zod.string(),
    startTime: zod.string(),
    duration: zod.string(),
    clientId: zod.string(),
    clientName: zod.string(),
  })
  .transform(({ clientId, clientName, duration, employeeId, id, startTime }) =>
    ProspectiveShift.build({
      id,
      startTime: LocalDateTime.parse(startTime),
      duration: Duration.parse(duration),
      employeeId,
      clientId,
      clientName,
    })
  );
