import { Duration, Instant, LocalDateTime } from '@js-joda/core';
import { Map, ValueObject } from 'immutable';
import { TypeProps } from '../../../../~shared/util/types';
import { EmployeeId } from '../../employee-registration/employee/employee-id';
import { ClientId } from '../../sales-contract-management/client/client-id';
import { RequirementId } from '../../sales-contract-management/requirement/requirement-id';
import { ServiceContractId } from '../../sales-contract-management/service-contract/service-contract-id';
import { ShiftId } from './shift-id';
import { Interval } from '@js-joda/extra';

export type IShift = {
  id: ShiftId;
  serviceContractId?: ServiceContractId;
  requirementIds?: RequirementId[];
  startTime: LocalDateTime;
  duration: Duration;
  clientId: ClientId;
  employeeId: EmployeeId;
  replacedShiftId?: ShiftId;
};

export class Shift implements ValueObject, IShift {
  public static build(params: {
    id: ShiftId;
    serviceContractId?: ServiceContractId;
    requirementIds?: RequirementId[];
    startTime: LocalDateTime;
    duration: Duration;
    clientId: ClientId;
    employeeId: EmployeeId;
    replacedShiftId?: ShiftId;
  }) {
    return new Shift(
      params.id,
      params.startTime,
      params.duration,
      params.clientId,
      params.employeeId,
      params.serviceContractId,
      params.requirementIds,
      params.replacedShiftId
    );
  }

  private readonly _vo: ValueObject;

  private constructor(
    public readonly id: ShiftId,
    public readonly startTime: LocalDateTime,
    public readonly duration: Duration,
    public readonly clientId: ClientId,
    public readonly employeeId: EmployeeId,
    public readonly serviceContractId?: ServiceContractId,
    public readonly requirementIds?: RequirementId[],
    public readonly replacedShiftId?: ShiftId
  ) {
    this._vo = Map<string, TypeProps<IShift>>()
      .set('id', this.id)
      .set('serviceContractId', this.serviceContractId)
      .set('requirementIds', this.requirementIds)
      .set('startTime', this.startTime)
      .set('duration', this.duration)
      .set('clientId', this.clientId)
      .set('employeeId', this.employeeId)
      .set('replacedShiftId', this.replacedShiftId);
  }

  equals(other: unknown): boolean {
    return this._vo.equals((other as Shift)?._vo);
  }

  hashCode(): number {
    return this._vo.hashCode();
  }

  with(params: Partial<Shift>): Shift {
    return new Shift(
      params.id ?? this.id,
      params.startTime ?? this.startTime,
      params.duration ?? this.duration,
      params.clientId ?? this.clientId,
      params.employeeId ?? this.employeeId,
      params.serviceContractId ?? this.serviceContractId,
      params.requirementIds ?? this.requirementIds,
      params.replacedShiftId ?? this.replacedShiftId
    );
  }

  getInterval(): Interval {
    return Interval.of(
      Instant.from(LocalDateTime.from(this.startTime)),
      Instant.from(LocalDateTime.from(this.startTime.plus(this.duration)))
    );
  }
}
