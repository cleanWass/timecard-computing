import { DateTimeFormatter, Duration } from '@js-joda/core';
import { Map, ValueObject } from 'immutable';
import { formatDurationAs100 } from '../../../~shared/util/joda-helper';
import { keys, TypeProps } from '../../../~shared/util/types';
import { Shift } from '../mission-delivery/shift/shift';
import { HoursTypeCodes, WorkedHoursRate } from './worked-hours-rate';

export type ShiftHoursContribution = {
  [k in WorkedHoursRate]?: Duration;
};

export interface IAnalyzedShift {
  shift: Shift;
  hoursBreakdown: ShiftHoursContribution;
  attributablePremiumAmount?: number;
  basePayAmount?: number;
  totalPayAmount?: number;
}

export class AnalyzedShift implements IAnalyzedShift, ValueObject {
  public static count = 0;
  private readonly _vo: ValueObject;

  static getShiftHoursContributionTotalDuration = (shiftHoursBreakdown: ShiftHoursContribution) =>
    keys(shiftHoursBreakdown).reduce(
      (acc, rate) => acc.plus(shiftHoursBreakdown[rate] || Duration.ZERO),
      Duration.ZERO
    );

  public static build({
    shift,
    hoursBreakdown,
    attributablePremiumAmount,
    basePayAmount,
    totalPayAmount,
  }: IAnalyzedShift) {
    return new AnalyzedShift(shift, hoursBreakdown);
  }

  private constructor(
    public readonly shift: Shift,
    public readonly hoursBreakdown: ShiftHoursContribution,
    public readonly attributablePremiumAmount?: number,
    public readonly basePayAmount?: number,
    public readonly totalPayAmount?: number
  ) {
    this._vo = Map<string, TypeProps<IAnalyzedShift>>()
      .set('shift', this.shift)
      .set('hoursBreakdown', this.hoursBreakdown)
      .set('attributablePremiumAmount', this.attributablePremiumAmount)
      .set('basePayAmount', this.basePayAmount)
      .set('totalPayAmount', this.totalPayAmount);
  }

  equals(other: AnalyzedShift): boolean {
    return this._vo.equals(other._vo);
  }

  hashCode(): number {
    return this._vo.hashCode();
  }

  with(params: Partial<IAnalyzedShift>): AnalyzedShift {
    return AnalyzedShift.build({
      shift: params.shift ?? this.shift,
      hoursBreakdown: params.hoursBreakdown ?? this.hoursBreakdown,
      attributablePremiumAmount: params.attributablePremiumAmount ?? this.attributablePremiumAmount,
      basePayAmount: params.basePayAmount ?? this.basePayAmount,
      totalPayAmount: params.totalPayAmount ?? this.totalPayAmount,
    });
  }

  debug() {
    return `${this.shift.id} : ${this.shift.startTime.format(
      DateTimeFormatter.ofPattern('dd/MM/yy: HH:mm')
    )} -> ${this.shift.startTime
      .plus(this.shift.duration)
      .format(DateTimeFormatter.ofPattern('HH:mm'))} ${keys(this.hoursBreakdown).reduce(
      (res, rate) =>
        `${res} | ${HoursTypeCodes[rate]} -> ${formatDurationAs100(
          this.hoursBreakdown[rate] || Duration.ZERO
        )}`,
      ''
    )}`;
  }
}
