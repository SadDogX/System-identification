import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Icon } from '@app/shared/ui';
import { Link } from '../../core/router.tsx';
import { groupHasActivePath, isNavItemActive, subgroupHasActivePath, type NavGroup } from './navigationConfig';

interface SidebarNavigationProps {
  navGroups: NavGroup[];
  path: string;
  menuOpen: boolean;
  onCloseMenu: () => void;
}

const DEFAULT_EXPANDED_GROUPS: Record<string, boolean> = { Обзор: true, Сотрудники: true };
const DEFAULT_EXPANDED_SUBGROUPS: Record<string, boolean> = {
  Удостоверения: true,
  'Работа и удостоверения': true,
  WPTS: true,
};

function toggleExpansion(
  setter: Dispatch<SetStateAction<Record<string, boolean>>>,
  label: string,
) {
  setter((current) => ({ ...current, [label]: !current[label] }));
}

export function SidebarNavigation({ navGroups, path, menuOpen, onCloseMenu }: SidebarNavigationProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(DEFAULT_EXPANDED_GROUPS);
  const [expandedSubgroups, setExpandedSubgroups] = useState<Record<string, boolean>>(DEFAULT_EXPANDED_SUBGROUPS);

  const activeGroupIndex = navGroups.findIndex((group) => groupHasActivePath(group, path));

  useEffect(() => {
    if (activeGroupIndex >= 0) {
      const activeGroup = navGroups[activeGroupIndex];
      setExpandedGroups((current) => ({ ...current, [activeGroup.label]: true }));

      for (const subgroup of activeGroup.subgroups ?? []) {
        if (subgroupHasActivePath(subgroup, path)) {
          setExpandedSubgroups((current) => ({ ...current, [subgroup.label]: true }));
        }
      }
    }
  }, [activeGroupIndex, navGroups, path]);

  return (
    <>
      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="brand">
          <Icon name="badge" />
          Учёт удостоверений
        </div>
        <div className="sidebar-settings">
          <Link
            to="/settings"
            className={`nav-link${isNavItemActive(path, '/settings') ? ' active' : ''}`}
            onClick={() => onCloseMenu()}
          >
            <Icon name="settings" />
            Настройки
          </Link>
        </div>
        <nav className="nav">
          {navGroups.map((group) => {
            const expanded = expandedGroups[group.label] ?? false;
            const active = groupHasActivePath(group, path);

            return (
              <div className={`nav-group${expanded ? ' expanded' : ''}`} key={group.label}>
                <button
                  type="button"
                  className={`nav-group-title${active ? ' active' : ''}`}
                  onClick={() => toggleExpansion(setExpandedGroups, group.label)}
                  aria-expanded={expanded}
                >
                  <Icon name={group.icon} small />
                  <span>{group.label}</span>
                  <span className="nav-group-chevron">{expanded ? '−' : '+'}</span>
                </button>
                {expanded && (
                  <div className="nav-group-items">
                    {(group.items ?? []).map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={`nav-link${isNavItemActive(path, item.to) ? ' active' : ''}`}
                        onClick={() => onCloseMenu()}
                      >
                        <Icon name={item.icon} />
                        {item.label}
                      </Link>
                    ))}
                    {(group.subgroups ?? []).map((subgroup) => {
                      const subgroupExpanded = expandedSubgroups[subgroup.label] ?? false;
                      const subgroupActive = subgroupHasActivePath(subgroup, path);

                      return (
                        <div className="nav-subgroup" key={subgroup.label}>
                          <button
                            type="button"
                            className={`nav-subgroup-title${subgroupActive ? ' active' : ''}`}
                            onClick={() => toggleExpansion(setExpandedSubgroups, subgroup.label)}
                            aria-expanded={subgroupExpanded}
                          >
                            <Icon name={subgroup.icon} small />
                            <span>{subgroup.label}</span>
                            <span className="nav-group-chevron">{subgroupExpanded ? '−' : '+'}</span>
                          </button>
                          {subgroupExpanded && (
                            <div className="nav-subgroup-items">
                              {subgroup.items.map((item) => (
                                <Link
                                  key={item.to}
                                  to={item.to}
                                  className={`nav-link${isNavItemActive(path, item.to) ? ' active' : ''}`}
                                  onClick={() => onCloseMenu()}
                                >
                                  <Icon name={item.icon} />
                                  {item.label}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
      <div className={`scrim${menuOpen ? ' open' : ''}`} onClick={() => onCloseMenu()} />
    </>
  );
}
