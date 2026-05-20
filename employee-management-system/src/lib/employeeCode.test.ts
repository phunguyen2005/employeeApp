import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatEmployeeCode } from './employeeCode';

describe('formatEmployeeCode', () => {
  it('formats employee numbers with the NV prefix and six digits', () => {
    assert.equal(formatEmployeeCode(1), 'NV-000001');
    assert.equal(formatEmployeeCode(53), 'NV-000053');
    assert.equal(formatEmployeeCode(123456), 'NV-123456');
  });

  it('rejects values that cannot be represented as professional employee codes', () => {
    assert.throws(() => formatEmployeeCode(0), /positive integer/);
    assert.throws(() => formatEmployeeCode(1.5), /positive integer/);
    assert.throws(() => formatEmployeeCode(1000000), /six digits/);
  });
});
