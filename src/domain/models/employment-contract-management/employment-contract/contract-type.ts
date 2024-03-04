export const CONTRACT_TYPE = ['CDI', 'CDD'] as const;

export type ContractType = (typeof CONTRACT_TYPE)[number];
