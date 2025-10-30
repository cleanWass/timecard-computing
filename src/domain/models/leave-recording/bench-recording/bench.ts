import { DateTimeFormatter, Duration, LocalDate, LocalDateTime } from '@js-joda/core';
import { pipe } from 'fp-ts/function';
import * as O from 'fp-ts/Option';
import { Map, ValueObject, Set } from 'immutable';

import { formatDurationAs100 } from '../../../../~shared/util/joda-helper';
import { TypeProps } from '../../../../~shared/util/types';
import { LocalTimeSlot } from '../../local-time-slot';
import { Client } from '../../mission-delivery/client/client';
import { Shift } from '../../mission-delivery/shift/shift';
import { BenchId } from './bench-id';

export type IBench = {
  id: BenchId;
  employeeId: string;
  date: LocalDate;
  timeslot: LocalTimeSlot;
  client: Client;
};

export class Bench implements ValueObject, IBench {
  private readonly _vo: ValueObject;

  public static build({ id, employeeId, date, timeslot, client }: IBench) {
    return new Bench(id, employeeId, date, timeslot, client);
  }

  public static isBench(shift: Shift): boolean {
    return shift.clientId === '0010Y00000Ijn8cQAB' || shift.type === 'Intercontrat';
  }

  public static totalBenchesDuration(benches: Set<Bench>): Duration {
    return benches.reduce((acc, bench) => acc.plus(bench.duration()), Duration.ZERO);
  }

  constructor(
    public readonly id: BenchId,
    public readonly employeeId: string,
    public readonly date: LocalDate,
    public readonly timeslot: LocalTimeSlot,
    public readonly client: Client
  ) {
    this._vo = Map<string, TypeProps<IBench>>()
      .set('id', this.id)
      .set('employeeId', this.employeeId)
      .set('date', this.date)
      .set('timeslot', this.timeslot)
      .set('client', this.client);
  }

  equals(other: unknown): boolean {
    return this._vo.equals((other as Bench)?._vo);
  }

  hashCode(): number {
    return this._vo.hashCode();
  }

  start() {
    return LocalDateTime.of(this.date, this.timeslot.startTime);
  }

  end() {
    return LocalDateTime.of(this.date, this.timeslot.endTime);
  }

  duration() {
    return this.timeslot.duration();
  }

  debug(): string {
    return `${this.employeeId} ${this.id} ${this.start().format(
      DateTimeFormatter.ofPattern('dd/MM/yy: HH:mm')
    )} -> ${this.end().format(DateTimeFormatter.ofPattern('HH:mm'))} ${this.client.name} ${
      this.client.id
    } ${formatDurationAs100(this.duration())}`;
  }
}
