export const EMPLOYEE_CODE_PREFIX = 'NV';
export const EMPLOYEE_CODE_DIGITS = 6;

export const formatEmployeeCode = (sequenceNumber: number) => {
  if (!Number.isInteger(sequenceNumber) || sequenceNumber <= 0) {
    throw new Error('Employee code sequence number must be a positive integer.');
  }

  if (sequenceNumber > 999999) {
    throw new Error('Employee code sequence number must fit within six digits.');
  }

  return `${EMPLOYEE_CODE_PREFIX}-${String(sequenceNumber).padStart(EMPLOYEE_CODE_DIGITS, '0')}`;
};
