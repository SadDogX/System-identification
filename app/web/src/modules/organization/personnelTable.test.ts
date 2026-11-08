import { describe, expect, it } from 'vitest';
import { filterAndSortPersonnel, type PersonnelRow } from './personnelTable.ts';

const bases = new Map([[1, 'North BPO'], [2, 'South BPO']]);
const employees: PersonnelRow[] = [
  { id: 8, user: { fullName: 'Boris Beta', login: 'beta08', phone: '+7 800 200', email: 'beta@example.test', systemRoles: [{ systemRole: { code: 'COORDINATOR' } }] }, assignments: [{ baseId: 2, track: 'TRS', position: { name: 'Coordinator' } }] },
  { id: 3, user: { fullName: 'Anna Alpha', login: 'alpha03', phone: null, email: 'anna@example.test', systemRoles: [{ systemRole: { code: 'EMPLOYEE' } }] }, assignments: [{ baseId: 1, track: 'R_AND_M', position: { name: 'Mechanic 2' } }] },
  { id: 5, user: { fullName: 'Empty Row', login: 'empty05', phone: null, email: null, systemRoles: [] }, assignments: [{ baseId: null, track: 'UNASSIGNED', position: null }] },
];

describe('personnel search and sorting', () => {
  it('searches all loaded rows by contact and BPO fields, case-insensitively', () => {
    expect(filterAndSortPersonnel(employees, 'BETA@EXAMPLE', 'name', 'asc', bases).map((row) => row.id)).toEqual([8]);
    expect(filterAndSortPersonnel(employees, 'south bpo', 'name', 'asc', bases).map((row) => row.id)).toEqual([8]);
    expect(filterAndSortPersonnel(employees, 'mechanic 2', 'name', 'asc', bases).map((row) => row.id)).toEqual([3]);
  });

  it('sorts ascending and descending with empty values last in either direction', () => {
    expect(filterAndSortPersonnel(employees, '', 'name', 'asc', bases).map((row) => row.id)).toEqual([3, 8, 5]);
    expect(filterAndSortPersonnel(employees, '', 'name', 'desc', bases).map((row) => row.id)).toEqual([5, 8, 3]);
    expect(filterAndSortPersonnel(employees, '', 'base', 'desc', bases).map((row) => row.id)).toEqual([8, 3, 5]);
  });

  it('uses numeric-aware locale sorting for role and position text', () => {
    expect(filterAndSortPersonnel(employees, '', 'position', 'asc', bases).map((row) => row.id)).toEqual([8, 3, 5]);
  });
});
