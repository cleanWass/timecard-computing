import { Duration, LocalDateTime } from '@js-joda/core';
import { EmployeeId } from '../../employee-registration/employee/employee-id';
import { Shift } from './shift';
import { ShiftId } from './shift-id';
import '@js-joda/timezone';

export class InactiveShift extends Shift {
  public static count = 0;
  public static build(params: {
    startTime: LocalDateTime;
    duration: Duration;
    employeeId: EmployeeId;
  }) {
    return new InactiveShift(
      `${InactiveShift.count++}`,
      params.startTime,
      params.duration,
      params.employeeId
    );
  }

  private constructor(
    public readonly id: ShiftId,
    public readonly startTime: LocalDateTime,
    public readonly duration: Duration,
    public readonly employeeId: EmployeeId
  ) {
    super(id, startTime, duration, 'fake-client-id', 'fake-client', 'Inactive', employeeId);
  }
}
