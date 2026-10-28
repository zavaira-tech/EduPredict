import { useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Popover,
  Select,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  ChevronDown,
  CircleHelp,
  Database,
  FileChartColumn,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  Moon,
  Search,
  Settings,
  ShieldAlert,
  Sun,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { initialNotifications } from "../../data/mockData.js";

const navigation = [
  {
    label: "WORKSPACE",
    items: [
      { title: "Dashboard", path: "/", icon: LayoutDashboard },
      { title: "Students", path: "/students", icon: Users },
      { title: "Teachers", path: "/teachers", icon: UserRound },
      { title: "Courses", path: "/courses", icon: BookOpen },
      { title: "Attendance", path: "/attendance", icon: Activity },
      { title: "Performance", path: "/performance", icon: GraduationCap },
    ],
  },
  {
    label: "INSIGHTS",
    items: [
      { title: "Predictions", path: "/predictions", icon: BarChart3, badge: "NEW" },
      { title: "Anomaly detection", path: "/anomalies", icon: ShieldAlert },
      { title: "Analytics & reports", path: "/analytics", icon: FileChartColumn },
      { title: "Datasets", path: "/datasets", icon: Database },
    ],
  },
  {
    label: "SUPPORT",
    items: [
      { title: "Alerts & notifications", path: "/alerts", icon: Bell, badge: "4" },
      { title: "Support center", path: "/support", icon: CircleHelp },
      { title: "Settings", path: "/settings", icon: Settings },
    ],
  },
];

const pageTitles = Object.fromEntries(
  navigation.flatMap((group) => group.items.map((item) => [item.path, item.title])),
);

function SidebarContent({ onNavigate, role, onNotify }) {
  return (
    <div className="sidebar-inner">
      <NavLink to="/" className="brand-lockup" onClick={onNavigate}>
        <div className="brand-mark"><GraduationCap size={22} strokeWidth={2.2} /></div>
        <div className="brand-name">EduPredict<span>ACADEMIC INTELLIGENCE</span></div>
      </NavLink>

      <div className="workspace-switcher">
        <div className="workspace-avatar">NU</div>
        <div className="workspace-copy"><strong>Northstar University</strong><span>Institution workspace</span></div>
        <ChevronDown size={15} />
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {navigation.map((group) => (
          <div className="nav-group" key={group.label}>
            <div className="nav-group-title">{group.label}</div>
            {group.items.map(({ title, path, icon: Icon, badge }) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/"}
                onClick={onNavigate}
                className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{title}</span>
                {badge && <small className={`nav-badge ${badge === "NEW" ? "badge-new" : ""}`}>{badge}</small>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="help-card">
          <div className="help-card-icon"><CircleHelp size={17} /></div>
          <strong>Need a hand?</strong>
          <span>Visit our help center for guides and support.</span>
          <Button size="small" onClick={() => onNotify("Help center is a demo destination")}>Get help <span>→</span></Button>
        </div>
        <button className="profile-button" onClick={() => onNotify(`${role} demo profile`)}>
          <Avatar className="profile-avatar">AJ</Avatar>
          <span className="profile-copy"><strong>Alex Johnson</strong><small>{role}</small></span>
          <LogOut size={16} className="profile-logout" />
        </button>
      </div>
    </div>
  );
}

export default function AppLayout({
  children,
  darkMode,
  onToggleTheme,
  role,
  roles,
  onRoleChange,
  onNotify,
  search,
  onSearchChange,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationAnchor, setNotificationAnchor] = useState(null);
  const [profileAnchor, setProfileAnchor] = useState(null);
  const [notifications, setNotifications] = useState(initialNotifications);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("lg"));
  const location = useLocation();

  const pageTitle = useMemo(() => pageTitles[location.pathname] || "Dashboard", [location.pathname]);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const markRead = (id) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification,
      ),
    );
  };

  const markAllRead = () => {
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
    onNotify("All notifications marked as read");
  };

  const sidebar = (
    <SidebarContent
      role={role}
      onNotify={onNotify}
      onNavigate={() => setMobileOpen(false)}
    />
  );

  return (
    <Box className={`app-shell${darkMode ? " dark-shell" : ""}`}>
      {!isMobile && <aside className="desktop-sidebar">{sidebar}</aside>}
      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        className="mobile-drawer"
        PaperProps={{ className: "mobile-drawer-paper" }}
      >
        <div className="mobile-drawer-close"><IconButton aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={19} /></IconButton></div>
        {sidebar}
      </Drawer>

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-left">
            {isMobile && <IconButton aria-label="Open navigation" className="mobile-menu-button" onClick={() => setMobileOpen(true)}><MenuIcon size={21} /></IconButton>}
            <div className="topbar-title-wrap">
              <div className="topbar-breadcrumb">EduPredict <span>/</span> <strong>{pageTitle}</strong></div>
              <Typography className="topbar-title">{pageTitle}</Typography>
            </div>
          </div>
          <div className="topbar-actions">
            <TextField
              size="small"
              placeholder="Search anything..."
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              className="global-search"
              inputProps={{ "aria-label": "Search dashboard and students" }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment>,
                endAdornment: <InputAdornment position="end"><kbd>⌘ K</kbd></InputAdornment>,
              }}
            />
            <div className="role-preview">
              <span>Preview as</span>
              <Select
                size="small"
                value={role}
                onChange={(event) => onRoleChange(event.target.value)}
                IconComponent={ChevronDown}
                aria-label="Preview role"
                className="role-select"
              >
                {roles.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </Select>
            </div>
            <Tooltip title={darkMode ? "Switch to light mode" : "Switch to dark mode"}>
              <IconButton className="header-icon-button" aria-label="Toggle theme" onClick={onToggleTheme}>
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Notifications">
              <IconButton
                className="header-icon-button notification-button"
                aria-label={`${unreadCount} unread notifications`}
                onClick={(event) => setNotificationAnchor(event.currentTarget)}
              >
                <Badge badgeContent={unreadCount} color="error" max={9}><Bell size={18} /></Badge>
              </IconButton>
            </Tooltip>
            <Divider orientation="vertical" flexItem className="topbar-divider" />
            <button className="topbar-user" onClick={(event) => setProfileAnchor(event.currentTarget)}>
              <Avatar className="topbar-avatar">AJ</Avatar>
              <span><strong>Alex Johnson</strong><small>{role}</small></span>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>

      <Popover
        open={Boolean(notificationAnchor)}
        anchorEl={notificationAnchor}
        onClose={() => setNotificationAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        className="notification-popover"
      >
        <div className="notification-menu">
          <div className="notification-menu-heading"><div><strong>Notifications</strong><span>{unreadCount} unread</span></div><button onClick={markAllRead}>Mark all read</button></div>
          {notifications.map((item) => (
            <button key={item.id} className={`notification-item${item.read ? " is-read" : ""}`} onClick={() => markRead(item.id)}>
              <span className="notification-item-dot" />
              <span><strong>{item.title}</strong><small>{item.text}</small><em>{item.time}</em></span>
            </button>
          ))}
          <button className="notification-footer" onClick={() => { setNotificationAnchor(null); onNotify("All notifications opened"); }}>View all notifications</button>
        </div>
      </Popover>
      <Menu
        anchorEl={profileAnchor}
        open={Boolean(profileAnchor)}
        onClose={() => setProfileAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={() => { setProfileAnchor(null); onNotify("Profile settings are coming in a later phase"); }}>My profile</MenuItem>
        <MenuItem onClick={() => { setProfileAnchor(null); onNotify("Account settings opened"); }}>Account settings</MenuItem>
        <MenuItem onClick={() => { setProfileAnchor(null); onNotify("This is a demo; no session was ended"); }}>Sign out</MenuItem>
      </Menu>
    </Box>
  );
}
