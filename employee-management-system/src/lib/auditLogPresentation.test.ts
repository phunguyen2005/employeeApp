import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildReadableAuditChanges,
  formatAuditChanges,
  formatAuditEventCode,
} from './auditLogPresentation';

const engineeringId = '11111111-1111-1111-1111-111111111111';
const missingDepartmentId = '22222222-2222-2222-2222-222222222222';

describe('audit log presentation helpers', () => {
  it('builds a stable professional event code from timestamp and audit id', () => {
    assert.equal(
      formatAuditEventCode('123e4567-e89b-12d3-a456-426614174000', '2026-05-21T08:30:00.000Z'),
      'AUD-20260521-123E45'
    );
  });

  it('renders department changes as readable names instead of UUIDs', () => {
    const changes = buildReadableAuditChanges(
      { departmentId: engineeringId, salary: 25000000 },
      { departmentId: missingDepartmentId, fullName: 'Nguyen Van A' },
      { [engineeringId]: 'Engineering' }
    );

    assert.deepEqual(JSON.parse(changes), {
      oldValues: {
        departmentId: 'Engineering',
        salary: 25000000,
      },
      newValues: {
        departmentId: 'Phòng ban không xác định',
        fullName: 'Nguyen Van A',
      },
    });

    assert.equal(
      formatAuditChanges(changes),
      'Trước khi thay đổi: Phòng ban: Engineering, Lương: 25.000.000; Sau khi thay đổi: Phòng ban: Phòng ban không xác định, Họ và tên: Nguyen Van A'
    );
  });
});
