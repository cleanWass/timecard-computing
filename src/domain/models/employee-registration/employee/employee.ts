import { LocalDate } from '@js-joda/core';
import { Map, ValueObject } from 'immutable';
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
  }) {
    return new Employee(
      params.id,
      params.firstName,
      params.lastName,
      params.role,
      params.seniorityDate,
      params.silaeId,
      params.email,
      params.phoneNumber,
      params.managerId,
      params.managerName,
      params.address
    );
  }

  public static buildFromJSON(json: any) {
    return new Employee(json.id, json.firstName, json.lastName, json.email, json.phoneNumber, JSON.parse(json.address));
  }

  private readonly _vo: ValueObject;

  private constructor(
    public readonly id: EmployeeId,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly role: EmployeeRole,
    public readonly seniorityDate: LocalDate,
    public readonly silaeId: string,
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
    >()
      .set('id', this.id)
      .set('firstName', this.firstName)
      .set('lastName', this.lastName)
      .set('silaeId', this.silaeId)
      .set('role', this.role)
      .set('seniorityDate', this.seniorityDate)
      .set('email', this.email)
      .set('phoneNumber', this.phoneNumber)
      .set('managerId', this.managerId)
      .set('managerName', this.managerName)
      .set('address', this.address);
  }

  equals(other: unknown): boolean {
    return this._vo.equals((other as Employee)?._vo);
  }

  hashCode(): number {
    return this._vo.hashCode();
  }

  debug() {
    return `Employee ${this.silaeId} ${this.firstName} ${this.lastName} ${this.role} ${this.seniorityDate}`;
  }
}
