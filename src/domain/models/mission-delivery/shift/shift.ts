import { DateTimeFormatter, Duration, Instant, LocalDateTime, ZoneId } from '@js-joda/core';
import { Map, ValueObject } from 'immutable';
import { TypeProps } from '../../../../~shared/util/types';
import { EmployeeId } from '../../employee-registration/employee/employee-id';
import { ClientId } from '../../sales-contract-management/client/client-id';
import { RequirementId } from '../../sales-contract-management/requirement/requirement-id';
import { ServiceContractId } from '../../sales-contract-management/service-contract/service-contract-id';
import { ShiftId } from './shift-id';
import { Interval } from '@js-joda/extra';
import '@js-joda/timezone';

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
    return Shift.build({
      id: params.id ?? this.id,
      startTime: params.startTime ?? this.startTime,
      duration: params.duration ?? this.duration,
      clientId: params.clientId ?? this.clientId,
      employeeId: params.employeeId ?? this.employeeId,
      serviceContractId: params.serviceContractId ?? this.serviceContractId,
      requirementIds: params.requirementIds ?? this.requirementIds,
      replacedShiftId: params.replacedShiftId ?? this.replacedShiftId,
    });
  }

  getInterval(): Interval {
    return Interval.of(
      Instant.from(LocalDateTime.from(this.startTime).atZone(ZoneId.of('Europe/Paris'))),
      Instant.from(LocalDateTime.from(this.startTime.plus(this.duration)).atZone(ZoneId.of('Europe/Paris')))
    );
  }

  getStartTime(): LocalDateTime {
    return this.startTime;
  }

  getEndTime(): LocalDateTime {
    return this.startTime.plus(this.duration);
  }

  debugFormat(): string {
    return `Shift ${this.id} client ${this.clientId} employee ${this.employeeId || 'unknown'} ${this.startTime.format(
      DateTimeFormatter.ofPattern('hh:mm dd/MM/yy')
    )} -> ${this.startTime.plus(this.duration).format(DateTimeFormatter.ofPattern('hh:mm dd/MM/yy'))}`;
  }
}
