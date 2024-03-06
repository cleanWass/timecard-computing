import { Duration, LocalDateTime } from '@js-joda/core';
import { EmployeeId } from '../../employee-registration/employee/employee-id';
import { Shift } from './shift';
import { ShiftId } from './shift-id';
import '@js-joda/timezone';

export class ProspectiveShift extends Shift {
  public static count = 0;
  public static build({
    id,
    clientId,
    clientName,
    startTime,
    duration,
    employeeId,
  }: {
    id: string;
    startTime: LocalDateTime;
    duration: Duration;
    employeeId: EmployeeId;
    clientId: string;
    clientName: string;
  }) {
    return new ProspectiveShift(id, startTime, duration, clientId, clientName, employeeId);
  }

  private constructor(
    public readonly id: ShiftId,
    public readonly startTime: LocalDateTime,
    public readonly duration: Duration,
    public readonly clientId: string,
    public readonly clientName: string,
    public readonly employeeId: EmployeeId
  ) {
    super(id, startTime, duration, clientId, clientName, 'Prospective', employeeId);
  }
}
