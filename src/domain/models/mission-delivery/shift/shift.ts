import { ChronoUnit, DateTimeFormatter, Duration, Instant, LocalDateTime, LocalTime, ZoneId } from '@js-joda/core';
import { Interval } from '@js-joda/extra';
import { Map, ValueObject } from 'immutable';
import { TypeProps } from '../../../../~shared/util/types';
import { EmployeeId } from '../../employee-registration/employee/employee-id';
import { LocalTimeSlot } from '../../local-time-slot';
import { ClientId } from '../../sales-contract-management/client/client-id';
import { RequirementId } from '../../sales-contract-management/requirement/requirement-id';
import { ServiceContractId } from '../../sales-contract-management/service-contract/service-contract-id';
import { ShiftId } from './shift-id';
import '@js-joda/timezone';
import { ShiftReason } from './shift-reason';

export type IShift = {
  id: ShiftId;
  startTime: LocalDateTime;
  duration: Duration;
  clientId: ClientId;
  clientName: string;
  type: ShiftReason;
  employeeId: EmployeeId;
  replacedShiftId?: ShiftId;
  requirementIds?: RequirementId[];
  serviceContractId?: ServiceContractId;
};

export class Shift implements ValueObject, IShift {
  public static build({
    clientId,
    clientName,
    duration,
    employeeId,
    id,
    replacedShiftId,
    requirementIds,
    serviceContractId,
    startTime,
    type,
  }: IShift) {
    return new Shift(
      id,
      startTime,
      duration,
      clientId,
      clientName,
      type,
      employeeId,
      serviceContractId,
      requirementIds,
      replacedShiftId
    );
  }

  private readonly _vo: ValueObject;

  constructor(
    public readonly id: ShiftId,
    public readonly startTime: LocalDateTime,
    public readonly duration: Duration,
    public readonly clientId: ClientId,
    public readonly clientName: string,
    public readonly type: ShiftReason,
    public readonly employeeId: EmployeeId,
    public readonly serviceContractId?: ServiceContractId,
    public readonly requirementIds?: RequirementId[],
    public readonly replacedShiftId?: ShiftId
  ) {
    this._vo = Map<string | ShiftReason, TypeProps<IShift>>()
      .set('id', this.id)
      .set('serviceContractId', this.serviceContractId)
      .set('requirementIds', this.requirementIds)
      .set('startTime', this.startTime)
      .set('duration', this.duration)
      .set('clientId', this.clientId)
      .set('type', this.type)
      .set('clientName', this.clientName)
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
      clientName: params.clientName ?? this.clientName,
      type: params.type ?? this.type,
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

  getTimeSlot() {
    return new LocalTimeSlot(this.startTime.toLocalTime(), this.getEndLocalTime());
  }

  getStartTime(): LocalDateTime {
    return this.startTime;
  }

  getEndTime(): LocalDateTime {
    return this.startTime.plus(this.duration);
  }

  getEndLocalTime(): LocalTime {
    return this.startTime.toLocalTime().plus(this.duration).compareTo(LocalTime.MIN) === 0
      ? LocalTime.MAX.truncatedTo(ChronoUnit.MINUTES)
      : this.startTime.toLocalTime().plus(this.duration);
  }

  debug(): string {
    return `${this.startTime.format(DateTimeFormatter.ofPattern('dd/MM/yy: HH:mm'))} -> ${this.startTime
      .plus(this.duration)
      .format(DateTimeFormatter.ofPattern('HH:mm'))}`;
  }
}
