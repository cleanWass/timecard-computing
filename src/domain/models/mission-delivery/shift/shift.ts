import {
  ChronoUnit,
  DateTimeFormatter,
  Duration,
  Instant,
  LocalDate,
  LocalDateTime,
  LocalTime,
  ZoneId,
} from '@js-joda/core';
import { Interval } from '@js-joda/extra';
import { pipe } from 'fp-ts/function';
import { getOrElse, Option } from 'fp-ts/Option';
import { Map, ValueObject } from 'immutable';
import { formatDurationAs100 } from '../../../../~shared/util/joda-helper';
import { TypeProps } from '../../../../~shared/util/types';
import { EmployeeId } from '../../employee-registration/employee/employee-id';
import { SilaeId } from '../../employee-registration/employee/silae-id';
import { EmploymentContract } from '../../employment-contract-management/employment-contract/employment-contract';
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
  silaeId?: string;
  employeeId: EmployeeId;
  replacedShiftId?: ShiftId;
  requirementIds?: RequirementId[];
  serviceContractId?: ServiceContractId;
  parentAffectationId?: Option<string>;
  precedenceDate?: Option<LocalDate>;
};

export class Shift implements ValueObject, IShift {
  public static build({
    clientId,
    clientName,
    duration,
    employeeId,
    silaeId,
    id,
    replacedShiftId,
    requirementIds,
    serviceContractId,
    startTime,
    type,
    precedenceDate,
    parentAffectationId,
  }: IShift) {
    return new Shift(
      id,
      startTime,
      duration,
      clientId,
      clientName,
      type,
      employeeId,
      silaeId,
      serviceContractId,
      requirementIds,
      replacedShiftId,
      precedenceDate,
      parentAffectationId
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
    public readonly silaeId?: SilaeId,
    public readonly serviceContractId?: ServiceContractId,
    public readonly requirementIds?: RequirementId[],
    public readonly replacedShiftId?: ShiftId,
    public readonly precedenceDate?: Option<LocalDate>,
    public readonly parentAffectationId?: Option<string>
  ) {
    this._vo = Map<string, TypeProps<IShift>>()
      .set('id', this.id)
      .set('serviceContractId', this.serviceContractId)
      .set('requirementIds', this.requirementIds)
      .set('startTime', this.startTime)
      .set('duration', this.duration)
      .set('clientId', this.clientId)
      .set('type', this.type)
      .set('clientName', this.clientName)
      .set('employeeId', this.employeeId)
      .set('silaeId', this.silaeId)
      .set('replacedShiftId', this.replacedShiftId)
      .set('precedenceDate', this.precedenceDate)
      .set('parentAffectationId', this.parentAffectationId);
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
      silaeId: params.silaeId ?? this.silaeId,
      serviceContractId: params.serviceContractId ?? this.serviceContractId,
      requirementIds: params.requirementIds ?? this.requirementIds,
      replacedShiftId: params.replacedShiftId ?? this.replacedShiftId,
      precedenceDate: params.precedenceDate ?? this.precedenceDate,
      parentAffectationId: params.parentAffectationId ?? this.parentAffectationId,
    });
  }

  getDuration(): Duration {
    if (this.startTime.plus(this.duration).toLocalTime().compareTo(LocalTime.MIDNIGHT) === 0) {
      return Duration.between(
        this.startTime,
        this.startTime.plus(this.duration).minusMinutes(1)
      ).plusMinutes(1);
    }
    return this.duration;
  }

  getTimeSlot() {
    return new LocalTimeSlot(this.startTime.toLocalTime(), this.getEndLocalTime());
  }

  getDate() {
    return this.startTime.toLocalDate();
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

  getPrecedenceDate(): LocalDate {
    return pipe(
      this.precedenceDate,
      getOrElse(() => this.startTime.toLocalDate())
    );
  }

  getNightTime() {
    return this.startTime.toLocalTime().isAfter(LocalTime.of(6))
      ? this.getTimeSlot().commonRange(EmploymentContract.nightShiftTimeSlots[0])
      : this.getTimeSlot().commonRange(EmploymentContract.nightShiftTimeSlots[1]);
  }

  isNightShift() {
    return (
      this.startTime.toLocalTime().compareTo(EmploymentContract.nightShiftTimeSlots[1].startTime) >=
      0
    );
  }

  isMorningShift() {
    return (
      this.startTime.toLocalTime().compareTo(EmploymentContract.nightShiftTimeSlots[0].endTime) < 0
    );
  }

  debug(): string {
    return `${this.employeeId || this.silaeId} ${this.id} ${this.startTime.format(
      DateTimeFormatter.ofPattern('dd/MM/yy: HH:mm')
    )} -> ${this.startTime.plus(this.duration).format(DateTimeFormatter.ofPattern('HH:mm'))} ${
      this.clientName
    } ${this.clientId} ${this.type} ${formatDurationAs100(this.getDuration())}`;
  }
}
