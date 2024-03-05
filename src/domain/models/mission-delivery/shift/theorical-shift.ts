import { Duration, LocalDateTime } from '@js-joda/core';
import { EmployeeId } from '../../employee-registration/employee/employee-id';
import { Shift } from './shift';
import { ShiftId } from './shift-id';
import '@js-joda/timezone';

export class TheoreticalShift extends Shift {
  public static count = 0;
  public static build(params: { startTime: LocalDateTime; duration: Duration; employeeId: EmployeeId }) {
    return new TheoreticalShift(`${TheoreticalShift.count++}`, params.startTime, params.duration, params.employeeId);
  }

  private constructor(
    public readonly id: ShiftId,
    public readonly startTime: LocalDateTime,
    public readonly duration: Duration,
    public readonly employeeId: EmployeeId
  ) {
    super(id, startTime, duration, 'facke-client-id', 'fake-client', 'fake', employeeId);
  }

  update(params: Partial<TheoreticalShift>) {
    return TheoreticalShift.build({
      startTime: params.startTime ?? this.startTime,
      duration: params.duration ?? this.duration,
      employeeId: params.employeeId ?? this.employeeId,
    });
  }
}
