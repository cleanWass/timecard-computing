export const EMPLOYEE_ROLE = [
  'Admin',
  'Cleaner',
  'Customer Service',
  'Event Staff',
  'Glazier',
  'Handyman',
  'Hotel Staff',
  'Manager',
  'Office Employee',
  'Team Leader',
] as const;

export type EmployeeRole = (typeof EMPLOYEE_ROLE)[number];
