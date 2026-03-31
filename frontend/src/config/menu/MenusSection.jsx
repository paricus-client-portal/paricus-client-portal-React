import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import LeaderboardOutlinedIcon from "@mui/icons-material/LeaderboardOutlined";
import AutoStoriesOutlinedIcon from "@mui/icons-material/AutoStoriesOutlined";
import LocalAtmOutlinedIcon from "@mui/icons-material/LocalAtmOutlined";
import VolumeUpOutlinedIcon from "@mui/icons-material/VolumeUpOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import CampaignIcon from "@mui/icons-material/Campaign";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import LocalActivityIcon from "@mui/icons-material/LocalActivity";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import PersonIcon from "@mui/icons-material/Person";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import AppRegistrationIcon from "@mui/icons-material/AppRegistration";
import DashboardIcon from "@mui/icons-material/Dashboard";
import BackupTableIcon from "@mui/icons-material/BackupTable";
import SwipeRightIcon from "@mui/icons-material/SwipeRight";
import AnnouncementIcon from "@mui/icons-material/Announcement";

// Drawer menu - Common items (visible based on permission)
export const menuItemsCommon = [
  {
    label: "dashboard",
    icon: <DashboardIcon fontSize="medium" />,
    route: "dashboard/kpi",
    permission: "view_dashboard",
    subItems: [
      {
        label: "dashboardKpi",
        icon: <BackupTableIcon fontSize="medium" />,
        route: "dashboard/kpi",
        permission: "view_dashboard",
      },
      {
        label: "dashboardSwiper",
        icon: <SwipeRightIcon fontSize="medium" />,
        route: "dashboard/swiper",
        permission: "view_dashboard",
      },
      {
        label: "dashboardGeneralInfo",
        icon: <AnnouncementIcon fontSize="medium" />,
        route: "dashboard/general-info",
        permission: "view_dashboard",
      },
    ],
  },
  {
    label: "reporting",
    icon: <LeaderboardOutlinedIcon fontSize="medium" />,
    route: "reporting",
    permission: "view_reporting",
  },
  {
    label: "audioRetrieval",
    icon: <VolumeUpOutlinedIcon fontSize="medium" />,
    route: "audio-recordings",
    permission: "view_interactions",
  },
  {
    label: "knowledgeBase",
    icon: <AutoStoriesOutlinedIcon fontSize="medium" />,
    route: "knowledge-base/articles",
    permission: "view_knowledge_base",
  },
  {
    label: "tickets",
    icon: <LocalActivityIcon fontSize="medium" />,
    route: "tickets/ticketTable",
    permission: "view_tickets",
  },
];

// Drawer menu - Admin items (visible based on permission)
export const menuItemsAdmin = [
  {
    label: "financial",
    icon: <LocalAtmOutlinedIcon fontSize="medium" />,
    route: "financial",
    permission: "view_financials",
  },
  {
    label: "reportsManagement",
    icon: <DescriptionOutlinedIcon fontSize="medium" />,
    route: "reports-management",
    permission: "admin_reports",
  },
  {
    label: "userManagement",
    icon: <SettingsOutlinedIcon fontSize="medium" />,
    route: "users-management/clients",
    permission: "admin_users",
    subItems: [
      {
        label: "clientManagement",
        icon: <PeopleAltIcon fontSize="medium" />,
        route: "users-management/clients",
        permission: "admin_clients",
      },
      {
        label: "usersManagement",
        icon: <PersonIcon fontSize="medium" />,
        route: "users-management/users",
        permission: "admin_users",
      },
      {
        label: "roleManagement",
        icon: <VerifiedUserIcon fontSize="medium" />,
        route: "users-management/rolesPermissions",
        permission: "admin_roles",
      },
      {
        label: "logs",
        icon: <AppRegistrationIcon fontSize="medium" />,
        route: "users-management/logs",
        permission: "admin_clients",
      },
    ],
  },
  {
    label: "broadcast",
    icon: <CampaignIcon fontSize="medium" />,
    route: "broadcast/quick-broadcast",
    permission: "admin_broadcast",
    subItems: [
      {
        label: "quickBroadcast",
        icon: <CampaignIcon fontSize="medium" />,
        route: "broadcast/quick-broadcast",
        permission: "broadcast_announcements",
      },
      {
        label: "swiperControl",
        icon: <AppRegistrationIcon fontSize="medium" />,
        route: "broadcast/swiper-control",
        permission: "broadcast_swiper",
      },
      {
        label: "kpiControl",
        icon: <AppRegistrationIcon fontSize="medium" />,
        route: "broadcast/kpi-control",
        permission: "broadcast_kpi",
      },
    ],
  },
];

// Avatar dropdown menu items
export const menuItemsAvatar = [
  {
    label: "myProfile",
    icon: <PersonOutlineIcon fontSize="small" />,
    route: "users-profile",
    permission: null, // Everyone can access their profile
  },
  {
    label: "userManagement",
    icon: <SettingsOutlinedIcon fontSize="small" />,
    route: "users-management",
    permission: "admin_users",
  },
];
