import { Duration, LocalDate } from '@js-joda/core';
import { EmploymentContract } from '../../../../../src/domain/models/employment-contract-management/employment-contract/employment-contract';
import { LocalDateRange } from '../../../../../src/domain/models/local-date-range';
import { WorkingPeriod } from '../../../../../src/domain/models/time-card-computation/working-period/working-period';

const employeeId = 'ezafkze';
const employmentContractId = 'pz^rgkz';

const clone = (base: WorkingPeriod, params?: Partial<Parameters<typeof WorkingPeriod.build>[0]>) =>
  WorkingPeriod.build({
    employeeId: params?.employeeId ?? base.employeeId,
    employmentContractId: params?.employmentContractId ?? base.employmentContractId,
    period: params?.period ?? base.period,
  });

const firstWeekOf2023 = WorkingPeriod.build({
  employeeId,
  employmentContractId,
  period: new LocalDateRange(LocalDate.parse('2023-01-02'), LocalDate.parse('2023-01-09')),
});

const partialFirstWeekOf2023 = WorkingPeriod.build({
  employeeId,
  employmentContractId,
  period: new LocalDateRange(LocalDate.parse('2023-01-05'), LocalDate.parse('2023-01-09')),
});

const otherPartialFirstWeekOf2023 = WorkingPeriod.build({
  employeeId,
  employmentContractId,
  period: new LocalDateRange(LocalDate.parse('2023-01-02'), LocalDate.parse('2023-01-04')),
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

  describe('.isComplete', () => {
    it('returns true when the period is complete', () => {
      expect(
        firstWeekOf2023.isComplete({
          overtimeAveragingPeriod: Duration.ofDays(7),
        } as EmploymentContract)
      ).toBe(true);
    });
    it('returns false when the period is not complete', () => {
      expect(
        partialFirstWeekOf2023.isComplete({
          overtimeAveragingPeriod: Duration.ofDays(7),
        } as EmploymentContract)
      ).toBe(false);
    });
    it('returns false when the period is not complete', () => {
      expect(
        otherPartialFirstWeekOf2023.isComplete({
          overtimeAveragingPeriod: Duration.ofDays(7),
        } as EmploymentContract)
      ).toBe(false);
    });
  });
});
