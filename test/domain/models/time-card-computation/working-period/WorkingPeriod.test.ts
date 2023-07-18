import {LocalDate} from '@js-joda/core';
import {WorkingPeriod} from '../../../../../src/domain/models/time-card-computation/working-period/WorkingPeriod';

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
    startDate: params?.startDate ?? base.startDate,
    endDate: params?.endDate ?? base.endDate,
  });

const firstWeekOf2023 = WorkingPeriod.build({
  employeeId,
  employmentContractId,
  startDate: LocalDate.parse('2023-01-02'),
  endDate: LocalDate.parse('2023-01-09'),
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
          clone(firstWeekOf2023, {endDate: firstWeekOf2023.endDate.plusDays(1)})
        )
      ).toBe(false);
    });
  });
});
