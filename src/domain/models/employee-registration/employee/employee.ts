import { DayOfWeek, LocalDate } from '@js-joda/core';
import { Map, Set, ValueObject } from 'immutable';
import { WeeklyPlanning } from '../../employment-contract-management/employment-contract/employment-contract';
import { LocalTimeSlot } from '../../local-time-slot';
import { EmployeeId } from './employee-id';
import { EmployeeRole } from './employee-role';

export class Employee implements ValueObject {
  public static build(params: {
    id: EmployeeId;
    firstName: string;
    lastName: string;
    seniorityDate: LocalDate;
    role: EmployeeRole;
    silaeId: string;
    email?: string;
    phoneNumber?: string;
    managerId?: string;
    managerName?: string;
    address?: {
      city?: string;
      street?: string;
      postalCode?: string;
    };
    availabilityPlanning?: WeeklyPlanning;
  }) {
    return new Employee(
      params.id,
      params.firstName,
      params.lastName,
      params.role,
      params.seniorityDate,
      params.silaeId,
      params.availabilityPlanning ?? Map<DayOfWeek, Set<LocalTimeSlot>>(),
      params.email,
      params.phoneNumber,
      params.managerId,
      params.managerName,
      params.address
    );
  }

  private readonly _vo: ValueObject;

  private constructor(
    public readonly id: EmployeeId,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly role: EmployeeRole,
    public readonly seniorityDate: LocalDate,
    public readonly silaeId: string,
    public readonly availabilityPlanning: WeeklyPlanning,
    public readonly email?: string,
    public readonly phoneNumber?: string,
    public readonly managerId?: string,
    public readonly managerName?: string,
    public readonly address?: { city?: string; street?: string; postalCode?: string }
  ) {
    this._vo = Map<
      string,
      | ValueObject
      | EmployeeRole
      | string
      | number
      | null
      | undefined
      | boolean
      | LocalDate
      | { city?: string; street?: string; postalCode?: string }
      | WeeklyPlanning
    >()
      .set('id', this.id)
      .set('firstName', this.firstName)
      .set('lastName', this.lastName)
      .set('silaeId', this.silaeId)
      .set('role', this.role)
      .set('seniorityDate', this.seniorityDate)
      .set('availabilityPlanning', this.availabilityPlanning)
      .set('email', this.email)
      .set('phoneNumber', this.phoneNumber)
      .set('managerId', this.managerId)
      .set('managerName', this.managerName)
      .set('address', this.address)
      .set('availabilityPlanning', this.availabilityPlanning);
  }

  equals(other: unknown): boolean {
    return this._vo.equals((other as Employee)?._vo);
  }

  hashCode(): number {
    return this._vo.hashCode();
  }

  debug({ showPlannings = false }: { showPlannings: boolean }) {
    return `Employee ${this.silaeId} ${this.firstName} ${this.lastName} ${this.role} ${
      this.seniorityDate
    }${
      showPlannings
        ? `\n${this.availabilityPlanning
            .map(
              (slots, day) =>
                `\t\t${day} -> ${
                  slots.isEmpty()
                    ? ' // '
                    : slots
                        .sortBy(s => s.startTime.toString())
                        .map(s => s.debug())
                        .join(' | ')
                }`
            )
            .join('\n')}`
        : ''
    }`;
  }
}
