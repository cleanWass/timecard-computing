import { Duration } from '@js-joda/core';
import { List, Map, ValueObject } from 'immutable';
import { formatDurationAs100 } from '../../../~shared/util/joda-helper';
import { Employee } from '../employee-registration/employee/employee';
import { EmploymentContract } from '../employment-contract-management/employment-contract/employment-contract';
import { LocalDateRange } from '../local-date-range';
import { WorkingPeriod } from '../time-card-computation/working-period/working-period';
import { ModulationDataWorkingPeriodCard } from './modulation-data-working-period-card';

export type ModulationDataWeeklyCardId = string;

export class ModulationDataWeeklyCard implements ValueObject {
  private static count = 0;

  public static build({
    week,
    employee,
    workingPeriods,
    employmentContracts,
    modulationDataWorkingPeriodCards,
  }: {
    week: LocalDateRange;
    employee: Employee;
    workingPeriods: List<WorkingPeriod>;
    employmentContracts: List<EmploymentContract>;
    modulationDataWorkingPeriodCards: List<ModulationDataWorkingPeriodCard>;
  }) {
    return new ModulationDataWeeklyCard(
      `${ModulationDataWeeklyCard.count++}`,
      employee,
      week,
      workingPeriods,
      employmentContracts,
      modulationDataWorkingPeriodCards
    );
  }

  private _vo: Map<string, ValueObject | string | number | boolean>;

  private constructor(
    public readonly id: ModulationDataWeeklyCardId,
    public readonly employee: Employee,
    public readonly week: LocalDateRange,
    public readonly workingPeriods: List<WorkingPeriod>,
    public readonly employmentContracts: List<EmploymentContract>,
    public readonly modulationDataWorkingPeriodCards: List<ModulationDataWorkingPeriodCard>
  ) {
    this._vo = Map<string, ValueObject | string | number | boolean>()
      .set('id', this.id)
      .set('employee', this.employee)
      .set('employmentContracts', this.employmentContracts)
      .set('week', this.week)
      .set('modulationDataWorkingPeriodCards', this.modulationDataWorkingPeriodCards)
      .set('workingPeriods', this.workingPeriods);
  }

  equals(other: unknown): boolean {
    return this._vo.equals((other as ModulationDataWeeklyCard)?._vo);
  }

  hashCode(): number {
    return this._vo.hashCode();
  }

  toString(): string {
    return JSON.stringify(this._vo.toJSON());
  }

  debug(full = false): string {
    return `ModulationDataWeeklyCard # ${this.id}
  InProportionWorkingTime: ${formatDurationAs100(this.getModulatedInProportionWorkingTime())}
  employee: ${this.employee.firstName} ${this.employee.lastName} - (${this.employee.silaeId}
  contracts: ${this.employmentContracts.map(c => c.debug()).join('\n')}
  week: ${this.week.toFormattedString()}
  workingPeriods: ${this.workingPeriods.map(wp => wp.period.toFormattedString()).join(' -- ')}
  modulationDataWorkingPeriodCards: ${
    full
      ? this.modulationDataWorkingPeriodCards.map(wpt => wpt.id).join(', ')
      : `${this.modulationDataWorkingPeriodCards.size} : ${this.modulationDataWorkingPeriodCards
          .map(wpt => `${wpt.id}->${wpt.workingPeriod.period.toFormattedString()}`)
          .join(', ')}`
  }
    `;
  }

  getModulatedInProportionWorkingTime() {
    return this.modulationDataWorkingPeriodCards.isEmpty()
      ? Duration.ZERO
      : Duration.ofMinutes(
          this.modulationDataWorkingPeriodCards
            .map(wpt => wpt.getModulatedInProportionWorkingTime())
            .reduce((a, b) => a + b.toMinutes(), 0)
        );
  }

  getTotalWorkedHours() {
    return ModulationDataWorkingPeriodCard.getTotalWorkedHours(
      this.modulationDataWorkingPeriodCards
    );
  }

  getTotalMealTickets() {
    return ModulationDataWorkingPeriodCard.getTotalMealTickets(
      this.modulationDataWorkingPeriodCards
    );
  }

  with(params: Partial<ModulationDataWeeklyCard>): ModulationDataWeeklyCard {
    return new ModulationDataWeeklyCard(
      params.id ?? this.id,
      params.employee ?? this.employee,
      params.week ?? this.week,
      params.workingPeriods ?? this.workingPeriods,
      params.employmentContracts ?? this.employmentContracts,
      params.modulationDataWorkingPeriodCards ?? this.modulationDataWorkingPeriodCards
    );
  }
}
