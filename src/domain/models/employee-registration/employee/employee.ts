import {Map, ValueObject} from 'immutable';
import {EmployeeId} from '../../employee-registration/employee/employee-id';

export class Employee implements ValueObject {
  public static build(params: {
    id: EmployeeId;
    firstName: string;
    lastName: string;
    email?: string;
    phoneNumber?: string;
    address?: {
      city?: string;
      street?: string;
      postalCode?: string;
    };
  }) {
    return new Employee(params.id, params.firstName, params.lastName, params.email, params.phoneNumber, params.address);
  }

  public static buildFromJSON(json: any) {
    return new Employee(json.id, json.firstName, json.lastName, json.email, json.phoneNumber, JSON.parse(json.address));
  }

  private readonly _vo: ValueObject;

  private constructor(
    public readonly id: EmployeeId,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly email?: string,
    public readonly phoneNumber?: string,
    public readonly address?: {city?: string; street?: string; postalCode?: string}
  ) {
    this._vo = Map<
      string,
      ValueObject | string | number | boolean | {city?: string; street?: string; postalCode?: string}
    >()
      .set('id', this.id)
      .set('firstName', this.firstName)
      .set('lastName', this.lastName)
      .set('email', this.email)
      .set('phoneNumber', this.phoneNumber)
      .set('address', this.address);
  }

  equals(other: unknown): boolean {
    return this._vo.equals((other as Employee)?._vo);
  }

  hashCode(): number {
    return this._vo.hashCode();
  }
}
