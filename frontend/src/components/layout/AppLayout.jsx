import { useEffect, useMemo, useRef, useState } from "react";
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
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import api from "../../services/api.js";

const navigation = [
  {
    label: "WORKSPACE",
    items: [
      { title: "Dashboard", path: "/", icon: LayoutDashboard },
      { title: "Users", path: "/users", icon: Users, roles: ["admin"] },
      { title: "Students", path: "/students", icon: Users, roles: ["admin", "teacher"] },
      { title: "Teachers", path: "/teachers", icon: UserRound, roles: ["admin", "teacher"] },
      { title: "Courses", path: "/courses", icon: BookOpen },
      { title: "Enrollments", path: "/enrollments", icon: Users, roles: ["admin", "teacher", "student", "analyst"] },
      { title: "Attendance", path: "/attendance", icon: Activity },
      { title: "Performance", path: "/performance", icon: GraduationCap },
    ],
  },
  {
    label: "INSIGHTS",
    items: [
      { title: "Predictions", path: "/predictions", icon: BarChart3, badge: "NEW" },
      { title: "Anomaly detection", path: "/anomalies", icon: ShieldAlert, roles: ["admin", "analyst"] },
      { title: "Analytics & reports", path: "/analytics", icon: FileChartColumn, roles: ["admin", "analyst"] },
      { title: "Datasets", path: "/datasets", icon: Database, roles: ["admin", "analyst"] },
    ],
  },
  {
    label: "SUPPORT",
    items: [
      { title: "Alerts & notifications", path: "/alerts", icon: Bell, roles: ["admin", "teacher", "student"] },
      { title: "Support center", path: "/support", icon: CircleHelp, roles: ["admin", "teacher", "student"] },
      { title: "Settings", path: "/settings", icon: Settings, roles: ["admin"] },
    ],
  },
];

const pageTitles = Object.fromEntries(
  navigation.flatMap((group) => group.items.map((item) => [item.path, item.title])),
);
pageTitles["/profile"] = "My profile";

function SidebarContent({ onNavigate, role, user, onLogout, onNotify }) {
  const initials = user?.name?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "EP";
  return (
    <div className="sidebar-inner">
      <NavLink to="/" className="brand-lockup" onClick={onNavigate}>
        <div className="brand-mark"><GraduationCap size={22} strokeWidth={2.2} /></div>
        <div className="brand-name">EduPredict<span>ACADEMIC INTELLIGENCE</span></div>
      </NavLink>

      <div className="workspace-switcher">
        <div className="workspace-avatar">NU</div>
        <div className="workspace-copy"><strong>EduPredict</strong><span>Institution workspace</span></div>
        <ChevronDown size={15} />
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {navigation.map((group) => {
          const visibleItems = group.items.filter((item) => !item.roles || item.roles.includes(role));
          if (!visibleItems.length) return null;
          return (
            <div className="nav-group" key={group.label}>
              <div className="nav-group-title">{group.label}</div>
              {visibleItems.map(({ title, path, icon: Icon, badge }) => (
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
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <div className="help-card">
          <div className="help-card-icon"><CircleHelp size={17} /></div>
          <strong>Need a hand?</strong>
          <span>Visit the support workspace for assistance.</span>
          <Button size="small" onClick={() => window.location.assign("/support")}>Get help <span>→</span></Button>
        </div>
        <button className="profile-button" onClick={onLogout} aria-label="Sign out">
          <Avatar className="profile-avatar">{initials}</Avatar>
          <span className="profile-copy"><strong>{user?.name}</strong><small>{role}</small></span>
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
  user,
  onLogout,
  onNotify,
  search,
  onSearchChange,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationAnchor, setNotificationAnchor] = useState(null);
  const [profileAnchor, setProfileAnchor] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const searchInputRef = useRef(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("lg"));
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (role === "analyst") {
      setNotifications([]);
      return;
    }
    api.get("/alerts")
      .then(({ data }) => setNotifications((data.data || []).map((item) => ({
        id: item._id,
        title: item.title,
        text: item.message,
        time: new Date(item.createdAt).toLocaleString(),
        read: item.isRead,
      }))))
      .catch((error) => onNotify(error.response?.data?.message || "Unable to load notifications.", "error"));
  }, [onNotify, role]);

  const pageTitle = useMemo(() => pageTitles[location.pathname] || "Dashboard", [location.pathname]);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  useEffect(() => {
    const handleSearchShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, []);

  const markRead = async (id) => {
    try {
      await api.put(`/alerts/${id}/read`);
      setNotifications((current) =>
        current.map((notification) => notification.id === id ? { ...notification, read: true } : notification),
      );
    } catch (error) {
      onNotify(error.response?.data?.message || "Unable to update this notification.", "error");
    }
  };

  const markAllRead = async () => {
    try {
      await Promise.all(notifications.filter((item) => !item.read).map((item) => api.put(`/alerts/${item.id}/read`)));
      setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
      onNotify("All notifications marked as read.");
    } catch (error) {
      onNotify(error.response?.data?.message || "Unable to mark notifications as read.", "error");
    }
  };

  const sidebar = (
    <SidebarContent
      role={role}
      user={user}
      onLogout={onLogout}
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
              inputRef={searchInputRef}
              onChange={(event) => onSearchChange(event.target.value)}
              className="global-search"
              inputProps={{ "aria-label": "Search dashboard and students" }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment>,
                endAdornment: <InputAdornment position="end"><kbd>Ctrl K</kbd></InputAdornment>,
              }}
            />
            <div className="role-preview"><span>Signed in</span><strong>{role}</strong></div>
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
              <Avatar className="topbar-avatar">{user?.name?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</Avatar>
              <span><strong>{user?.name}</strong><small>{role}</small></span>
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
          <button className="notification-footer" onClick={() => { setNotificationAnchor(null); navigate("/alerts"); }}>View all notifications</button>
        </div>
      </Popover>
      <Menu
        anchorEl={profileAnchor}
        open={Boolean(profileAnchor)}
        onClose={() => setProfileAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={() => { setProfileAnchor(null); navigate("/profile"); }}>My profile</MenuItem>
        <MenuItem onClick={() => { setProfileAnchor(null); onLogout(); }}>Sign out</MenuItem>
      </Menu>
    </Box>
  );
}
