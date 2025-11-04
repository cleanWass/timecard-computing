import { v4 as uuid } from 'uuid';
import { DayOfWeek, Duration, LocalDate } from '@js-joda/core';

import {
  BenchPayloadDto,
  durationToPgInterval,
} from '../../../../application/ports/repositories/bench-payload.dto';

import { BenchAffectation } from '../../../../domain/services/bench-generation/types';
import { toHoursFloat } from '../../../../~shared/util/joda-helper';

export const mapBenchToBenchPayloadDto = (bench: BenchAffectation): BenchPayloadDto => ({
  accountId: '0010Y00000Ijn8cQAB',
  accountName: 'Cleany - Intercontrat',
  silaeId: bench.employee.silaeId,
  // active: true,
  // bundle_id: 'bot',
  // catalog_item_family: 'Prestations horaires effectuées par Cleany',
  catalogItemId: '01t0Y000001C4C7QAK',
  // catalog_item_name: 'Nettoyage',
  // cleaner_email: bench.employee.email,
  // cleaner_fullname: `${bench.employee.firstName} ${bench.employee.lastName}`,
  cleanerId: bench.employee.id,
  // cleaner_mobile_phone: bench.employee.phoneNumber,
  // cleaner_phone: bench.employee.phoneNumber,
  // cleany_app_id: 'af86c12c-0160-49c0-9fa6-dd80d924f616',
  contractId: '8011n00000EiAx4AAF',
  // contract_type: 'Récurrent',
  // created_date: LocalDate.now().toString(),
  duration: durationToPgInterval(bench.slot.duration()),
  // duration_per_week: durationToPgInterval(
  //   bench.days.reduce(acc => acc.plus(bench.slot.duration()), Duration.ZERO)
  // ),
  endDate: bench.period.end.minusDays(1).toString(),
  // end_date_lookup: '3000-12-31',
  // end_date_next_day: null,
  endTime: bench.slot.endTime.toString(),
  // event_id: null,
  // id: `intercontract-${uuid()}`,
  // last_modified_date: LocalDate.now().toString(),
  // manager_email: 'juliette@cleany.fr',
  // manager_fullname: 'Juliette Arnautou',
  // manager_id: '0030Y00001NDqibQAD',
  // manager_mobile_phone: '+33 6 78 89 01 40',
  // manager_phone: '+33 6 78 89 01 40',
  // metadata: null,
  // nb_worked_days: bench.days.size,
  // operational_email: 'vincent@cleany.fr',
  // operational_fullname: 'Vincent Pereira',
  // operational_id: '0030Y00001PaLiLQAV',
  // operational_mobile_phone: '+33 6 44 86 00 23',
  // operational_phone: '+33 6 44 86 00 23',
  // opportunity_name: 'Test Cleany',
  prestationType: 'CLEANING',
  punctualReason: null,
  // related_affectation_id: null,
  // site_address: '9 Rue Pleyel, 93200 Saint-Denis',
  startDate: bench.period.start.toString(),
  startTime: bench.slot.startTime.toString(),
  // status: 'Current',
  // status_covid: 'Passif',
  totalDuration: toHoursFloat(
    bench.days.reduce(acc => acc.plus(bench.slot.duration()), Duration.ZERO)
  ),

  // transit_stop: 'Ligne 13, Métro Garibaldi',
  type: 'Intercontrat',
  days: {
    monday: bench.days.includes(DayOfWeek.MONDAY),
    tuesday: bench.days.includes(DayOfWeek.TUESDAY),
    wednesday: bench.days.includes(DayOfWeek.WEDNESDAY),
    thursday: bench.days.includes(DayOfWeek.THURSDAY),
    friday: bench.days.includes(DayOfWeek.FRIDAY),
    saturday: bench.days.includes(DayOfWeek.SATURDAY),
    sunday: bench.days.includes(DayOfWeek.SUNDAY),
  },
});
