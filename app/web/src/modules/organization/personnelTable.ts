export type PersonnelSortKey = 'name' | 'login' | 'track' | 'position' | 'base' | 'roles';
export type PersonnelSortDirection = 'asc' | 'desc';

export interface PersonnelRow {
  id: number;
  user: {
    fullName: string;
    login: string;
    phone: string | null;
    email: string | null;
    systemRoles: { systemRole: { code: string } }[];
  };
  assignments: {
    baseId: number | null;
    track: 'TRS' | 'R_AND_M' | 'UNASSIGNED';
    position: { name: string } | null;
  }[];
}

function normalized(value: string) {
  return value.trim().toLocaleLowerCase('ru-RU');
}

function rowSearchText(row: PersonnelRow, baseNames: Map<number, string>) {
  const assignment = row.assignments[0];
  const track = assignment?.track === 'R_AND_M' ? 'Цеховой' : assignment?.track === 'TRS' ? 'Полевой' : 'Не назначен';
  const base = assignment?.baseId === null || assignment?.baseId === undefined ? '' : baseNames.get(assignment.baseId) ?? '';
  const roles = row.user.systemRoles.map((grant) => grant.systemRole.code).join(' ');
  return normalized([
    row.user.fullName,
    row.user.login,
    row.user.phone ?? '',
    row.user.email ?? '',
    track,
    assignment?.position?.name ?? '',
    base,
    roles,
    String(row.id),
  ].join(' '));
}

function sortValue(row: PersonnelRow, key: PersonnelSortKey, baseNames: Map<number, string>): string | number | null {
  const assignment = row.assignments[0];
  switch (key) {
    case 'name': return row.user.fullName;
    case 'login': return row.user.login;
    case 'track': return assignment?.track === 'R_AND_M' ? 'Цеховой' : assignment?.track === 'TRS' ? 'Полевой' : 'Не назначен';
    case 'position': return assignment?.position?.name ?? null;
    case 'base': return assignment?.baseId === null || assignment?.baseId === undefined ? null : baseNames.get(assignment.baseId) ?? null;
    case 'roles': return row.user.systemRoles.map((grant) => grant.systemRole.code).join(', ');
  }
}

/** Filters and sorts the complete permission-scoped employee dataset. Empty values stay last in either direction. */
export function filterAndSortPersonnel<T extends PersonnelRow>(
  rows: T[],
  query: string,
  key: PersonnelSortKey,
  direction: PersonnelSortDirection,
  baseNames: Map<number, string>,
): T[] {
  const term = normalized(query);
  return rows
    .filter((row) => !term || rowSearchText(row, baseNames).includes(term))
    .sort((left, right) => {
      const a = sortValue(left, key, baseNames);
      const b = sortValue(right, key, baseNames);
      const aEmpty = a === null || (typeof a === 'string' && a.trim() === '');
      const bEmpty = b === null || (typeof b === 'string' && b.trim() === '');
      if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
      if (aEmpty && bEmpty) return left.id - right.id;
      const compared = typeof a === 'number' && typeof b === 'number'
        ? a - b
        : String(a).localeCompare(String(b), 'ru', { numeric: true, sensitivity: 'base' });
      return compared ? (direction === 'asc' ? compared : -compared) : left.id - right.id;
    });
}
