import {LocalDateRange} from '@domain/models/local-date-range';
import {LocalDate} from '@js-joda/core';

import {WorkingPeriod} from '@domain/models/time-card-computation/working-period/WorkingPeriod';

const employeeId = 'ezafkze';
const employmentContractId = 'pz^rgkz';

const clone = (
  base: WorkingPeriod,
  params?: Partial<Parameters<typeof WorkingPeriod.build>[0]>
) =>
  WorkingPeriod.build({
    employeeId: params?.employeeId ?? base.employeeId,
    employmentContractId:
      params?.employmentContractId ?? base.employmentContractId,
    period: params?.period ?? base.period,
  });

const firstWeekOf2023 = WorkingPeriod.build({
  employeeId,
  employmentContractId,
  period: new LocalDateRange(
    LocalDate.parse('2023-01-02'),
    LocalDate.parse('2023-01-09')
  ),
});

describe('WorkingPeriod', () => {
  describe('.equals', () => {
    it('returns true with identical objects', () => {
      expect(firstWeekOf2023.equals(firstWeekOf2023)).toBe(true);
    });

    it('returns true with identical objects', () => {
      expect(firstWeekOf2023.equals(clone(firstWeekOf2023))).toBe(true);
    });

    it('returns false with different objects', () => {
      expect(
        firstWeekOf2023.equals(
          clone(firstWeekOf2023, {
            period: firstWeekOf2023.period.with({
              end: firstWeekOf2023.period.end.plusDays(1),
            }),
          })
        )
      ).toBe(false);
    });
  });
});
