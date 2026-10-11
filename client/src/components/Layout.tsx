import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import BadgeIcon from '@mui/icons-material/Badge';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SendIcon from '@mui/icons-material/Send';
import HistoryIcon from '@mui/icons-material/History';
import PersonIcon from '@mui/icons-material/Person';
import { useAuth, useCurrentUser } from '../auth/AuthContext';
import { ROLE_LABELS } from '../utils';
import { NotificationBell } from './NotificationBell';

const DRAWER_WIDTH = 248;

const ADMIN_NAV = [
  { to: '/admin/dashboard', label: 'Дашборд', icon: DashboardIcon },
  { to: '/admin/users', label: 'Пользователи', icon: PeopleIcon },
  { to: '/admin/credentials', label: 'Удостоверения', icon: BadgeIcon },
  { to: '/admin/catalog', label: 'Справочник', icon: MenuBookIcon },
  { to: '/admin/notifications', label: 'Уведомления', icon: NotificationsIcon },
  { to: '/admin/messages', label: 'Сообщения', icon: SendIcon },
  { to: '/admin/audit-log', label: 'Журнал действий', icon: HistoryIcon },
];

const USER_NAV = [
  { to: '/user/dashboard', label: 'Главная', icon: DashboardIcon },
  { to: '/user/credentials', label: 'Мои удостоверения', icon: BadgeIcon },
  { to: '/user/notifications', label: 'Уведомления', icon: NotificationsIcon },
  { to: '/user/profile', label: 'Профиль', icon: PersonIcon },
];

function initials(fullName: string) {
  return fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function Layout() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const nav = user.role === 'ADMIN' ? ADMIN_NAV : USER_NAV;

  const drawer = (
    <Box>
      <Toolbar>
        <BadgeIcon color="primary" sx={{ mr: 1 }} />
        <Typography fontWeight={700} color="primary">
          Учёт удостоверений
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ px: 1 }}>
        {nav.map(({ to, label, icon: Icon }) => (
          <ListItemButton
            key={to}
            component={NavLink}
            to={to}
            onClick={() => setMobileOpen(false)}
            sx={{
              borderRadius: 1,
              mb: 0.5,
              '&.active': { bgcolor: 'primary.main', color: 'primary.contrastText', '& .MuiListItemIcon-root': { color: 'inherit' } },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={label} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" color="inherit" elevation={0} sx={{ borderBottom: '1px solid #e3e7eb', ml: { md: `${DRAWER_WIDTH}px` }, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` } }}>
        <Toolbar>
          {!isDesktop && (
            <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <NotificationBell />
          <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ ml: 1 }}>
            <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 14 }}>{initials(user.fullName)}</Avatar>
          </IconButton>
          <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography fontWeight={600}>{user.fullName}</Typography>
              <Typography variant="body2" color="text.secondary">
                {ROLE_LABELS[user.role]} · {user.login}
              </Typography>
            </Box>
            <Divider />
            {user.role === 'USER' && (
              <MenuItem onClick={() => { setMenuAnchor(null); navigate('/user/profile'); }}>Профиль</MenuItem>
            )}
            <MenuItem onClick={() => { setMenuAnchor(null); navigate('/change-password'); }}>Сменить пароль</MenuItem>
            <MenuItem onClick={() => { setMenuAnchor(null); logout().then(() => navigate('/login')); }}>Выйти</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={isDesktop ? 'permanent' : 'temporary'}
          open={isDesktop || mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', borderRight: '1px solid #e3e7eb' } }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, md: 3 }, mt: 8 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
