import { Prisma } from '@prisma/client';
import { formatEmployeeCode } from '../../lib/employeeCode';

type EmployeeCodeSequenceRow = {
  nextValue: bigint | number | string;
};

export const getNextEmployeeCode = async (tx: Prisma.TransactionClient) => {
  const [row] = await tx.$queryRaw<EmployeeCodeSequenceRow[]>`
    SELECT NEXT VALUE FOR [dbo].[EmployeeCodeSequence] AS nextValue
  `;

  if (!row) {
    throw new Error('Unable to allocate the next employee code.');
  }

  return formatEmployeeCode(Number(row.nextValue));
};
