
export const computeTimeCardForPeriod = (
  payload: TimeCardPayload
): TimeCard => {
  let workedHoursByType: HoursTypeRecap = initializeWorkedHours();

  const generatedWeeksFromPeriod = generateWeeksFromPeriod(
    payload.contractPeriod.period
  );

  generatedWeeksFromPeriod.map((week) => {
    const shiftsDuringWeek = payload.shifts.filter(isShiftDuringPeriod(week));

    let totalWeeklyHours = computeWeeklyHours(
      shiftsDuringWeek,
      payload.contractPeriod.contract
    );

    workedHoursByType = getSumOfTwoWeekWorkingHours(
      workedHoursByType,
      totalWeeklyHours
    );
  });

  return {
    cleanerId: payload.cleanerId,
    workedHours: workedHoursByType,
    contractPeriod: payload.contractPeriod
  };
};
