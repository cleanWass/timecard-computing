import { List, Map, ValueObject } from 'immutable';
import { formatDuration, formatDurationAs100 } from '../../../~shared/util/joda-helper';
import { Employee } from '../employee-registration/employee/employee';
import { EmploymentContract } from '../employment-contract-management/employment-contract/employment-contract';
import { LocalDateRange } from '../local-date-range';
import { HoursTypeCodes } from '../cost-efficiency/worked-hours-rate';
import { WorkingPeriod } from '../time-card-computation/working-period/working-period';
import { ModulationDataMonthlyCard } from './modulation-data-monthly-card';
import { ModulationDataWeeklyCard } from './modulation-data-weekly-card';
import { ModulationDataWorkingPeriodCard } from './modulation-data-working-period-card';
import { SurchargedHoursPool } from './surcharged-hours-pool';
import { Duration } from '@js-joda/core';

export type ModulationDataRecapId = string;

export class ModulationDataRecap implements ValueObject {
  private static count = 0;

  public static build({
    period,
    employee,
    workingPeriods,
    employmentContracts,
    modulationDataWorkingPeriodCards,
    modulationDataWeeklyCards,
    modulationDataMonthlyCards,
  }: {
    period: LocalDateRange;
    employee: Employee;
    workingPeriods: List<WorkingPeriod>;
    employmentContracts: List<EmploymentContract>;
    modulationDataWorkingPeriodCards: List<ModulationDataWorkingPeriodCard>;
    modulationDataWeeklyCards: List<ModulationDataWeeklyCard>;
    modulationDataMonthlyCards: List<ModulationDataMonthlyCard>;
  }) {
    return new ModulationDataRecap(
      `${ModulationDataRecap.count++}`,
      employee,
      period,
      workingPeriods,
      employmentContracts,
      modulationDataWorkingPeriodCards,
      modulationDataWeeklyCards,
      modulationDataMonthlyCards
    );
  }

  private _vo: Map<string, ValueObject | string | number | boolean>;

  private constructor(
    public readonly id: ModulationDataRecapId,
    public readonly employee: Employee,
    public readonly period: LocalDateRange,
    public readonly workingPeriods: List<WorkingPeriod>,
    public readonly employmentContracts: List<EmploymentContract>,
    public readonly modulationDataWorkingPeriodCards: List<ModulationDataWorkingPeriodCard>,
    public readonly modulationDataWeeklyCards: List<ModulationDataWeeklyCard>,
    public readonly modulationDataMonthlyCards: List<ModulationDataMonthlyCard>
  ) {
    this._vo = Map<string, ValueObject | string | number | boolean>()
      .set('id', this.id)
      .set('employee', this.employee)
      .set('employmentContracts', this.employmentContracts)
      .set('period', this.period)
      .set('modulationDataWorkingPeriodCards', this.modulationDataWorkingPeriodCards)
      .set('modulationDataWeeklyCards', this.modulationDataWeeklyCards)
      .set('workingPeriods', this.workingPeriods)
      .set('modulationDataMonthlyCards', this.modulationDataMonthlyCards);
  }

  equals(other: unknown): boolean {
    return this._vo.equals((other as ModulationDataRecap)?._vo);
  }

  hashCode(): number {
    return this._vo.hashCode();
  }

  toString(): string {
    return JSON.stringify(this._vo.toJSON());
  }

  debug(): string {
    return `
  ModulationDataRecap # ${this.id}
  Semester: ${this.period.toFormattedString()}
  Contractual hours: ${formatDuration(
    this.modulationDataWorkingPeriodCards.reduce(
      (acc, wpc) => acc.plus(wpc.getModulatedInProportionWorkingTime()),
      Duration.ZERO
    )
  )}
  WorkedHours: 
    ${this.getTotalWorkedHours()
      .toSeq()
      .map((duration, rate) =>
        duration.isZero() ? `` : `${HoursTypeCodes[rate]} -> ${formatDurationAs100(duration)}`
      )
      .filter(s => s)
      .join('\n\t\t')}
  SurchargedHoursPool:
    ${this.getTotalSurchargedHoursPool()
      .toSeq()
      .map((duration, rate) =>
        duration.isZero() ? `` : `${HoursTypeCodes[rate]} -> ${formatDurationAs100(duration)}`
      )
      .filter(s => s)
      .join('\n\t\t')}
      `;
  }

  fullDebug(): string {
    return `
  ModulationDataRecap # ${this.id}
  employee: ${this.employee.firstName} ${this.employee.lastName} - (${this.employee.silaeId}
  contracts: ${this.employmentContracts.map(c => c.debug()).join('\n')}
  semester: ${this.period.toFormattedString()}
  workingPeriods: ${this.workingPeriods.map(wp => wp.toString()).join('\n')}
  modulationDataWorkingPeriodCards: ${this.modulationDataWorkingPeriodCards
    .map(wpt => wpt.id)
    .join(', ')}
  modulationDataWeeklyCards: ${this.modulationDataWeeklyCards.map(wpt => wpt.id).join(', ')}
  modulationDataMonthlyCards: ${this.modulationDataMonthlyCards.map(wpt => wpt.id).join(', ')}
  WorkedHours: 
    ${this.getTotalWorkedHours()
      .toSeq()
      .map((duration, rate) =>
        duration.isZero() ? `` : `${HoursTypeCodes[rate]} -> ${formatDurationAs100(duration)}`
      )
      .filter(s => s)
      .join('\n\t\t')}
  SurchargedHoursPool:
    ${this.getTotalSurchargedHoursPool()
      .toSeq()
      .map((duration, rate) =>
        duration.isZero() ? `` : `${HoursTypeCodes[rate]} -> ${formatDurationAs100(duration)}`
      )
      .filter(s => s)
      .join('\n\t\t')}
      `;
  }

  getTotalWorkedHours() {
    return ModulationDataWorkingPeriodCard.getTotalWorkedHours(
      this.modulationDataWorkingPeriodCards
    );
  }

  getTotalSurchargedHoursPool() {
    return this.modulationDataWorkingPeriodCards.reduce(
      (acc, wpc) =>
        new SurchargedHoursPool({
          ElevenPercentRateComplementary: acc.ElevenPercentRateComplementary.plus(
            wpc.surchargedHoursPool.ElevenPercentRateComplementary
          ),
          TenPercentRateComplementary: acc.TenPercentRateComplementary.plus(
            wpc.surchargedHoursPool.TenPercentRateComplementary
          ),
          TwentyFivePercentRateComplementary: acc.TwentyFivePercentRateComplementary.plus(
            wpc.surchargedHoursPool.TwentyFivePercentRateComplementary
          ),
          TwentyFivePercentRateSupplementary: acc.TwentyFivePercentRateSupplementary.plus(
            wpc.surchargedHoursPool.TwentyFivePercentRateSupplementary
          ),
          FiftyPercentRateSupplementary: acc.FiftyPercentRateSupplementary.plus(
            wpc.surchargedHoursPool.FiftyPercentRateSupplementary
          ),
        }),
      new SurchargedHoursPool()
    );
  }

  getTotalMealTickets() {
    return ModulationDataWorkingPeriodCard.getTotalMealTickets(
      this.modulationDataWorkingPeriodCards
    );
  }

  with(params: Partial<ModulationDataRecap>): ModulationDataRecap {
    return new ModulationDataRecap(
      params.id ?? this.id,
      params.employee ?? this.employee,
      params.period ?? this.period,
      params.workingPeriods ?? this.workingPeriods,
      params.employmentContracts ?? this.employmentContracts,
      params.modulationDataWorkingPeriodCards ?? this.modulationDataWorkingPeriodCards,
      params.modulationDataWeeklyCards ?? this.modulationDataWeeklyCards,
      params.modulationDataMonthlyCards ?? this.modulationDataMonthlyCards
    );
  }
}
