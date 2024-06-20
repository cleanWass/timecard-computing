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

export const EMPLOYEE_ROLE_TRANSLATIONS = {
  Admin: 'Administrateur',
  Cleaner: 'Cleaner',
  'Customer Service': 'Support Clientèle',
  'Event Staff': 'Événementiel',
  Glazier: 'Vitrier',
  Handyman: 'Polyvalent',
  'Hotel Staff': 'Hôtellerie',
  Manager: 'Manager',
  'Office Employee': 'Employé de bureau',
  'Team Leader': "Chef d'équipe",
};

export type EmployeeRole = (typeof EMPLOYEE_ROLE)[number];
