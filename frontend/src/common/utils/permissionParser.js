/**
 * List of all available permissions in the system.
 * This is used as a reference/fallback when permissions can't be fetched from API.
 */
export const permissionList = [
  { id: 1, permissionName: "view_dashboard", description: "View dashboard and basic metrics" },
  { id: 2, permissionName: "view_financials", description: "View financial information and invoices" },
  { id: 3, permissionName: "download_invoices", description: "Download invoice files" },
  { id: 4, permissionName: "view_reporting", description: "View reports and KPIs" },
  { id: 5, permissionName: "download_reports", description: "Download report files" },
  { id: 6, permissionName: "view_interactions", description: "View interaction history" },
  { id: 7, permissionName: "download_audio_files", description: "Download audio interaction files" },
  { id: 8, permissionName: "view_knowledge_base", description: "View knowledge base articles" },
  { id: 9, permissionName: "create_kb_articles", description: "Create knowledge base articles" },
  { id: 10, permissionName: "edit_kb_articles", description: "Edit knowledge base articles" },
  { id: 11, permissionName: "admin_clients", description: "Manage clients (BPO Admin only)" },
  { id: 12, permissionName: "admin_users", description: "Manage users (BPO Admin only)" },
  { id: 13, permissionName: "admin_roles", description: "Manage roles and permissions (BPO Admin only)" },
  { id: 14, permissionName: "admin_reports", description: "Upload and manage client reports (BPO Admin only)" },
  { id: 15, permissionName: "admin_dashboard_config", description: "Configure dashboard layouts (BPO Admin only)" },
  { id: 16, permissionName: "admin_invoices", description: "Manage invoices (BPO Admin only)" },
  { id: 17, permissionName: "view_invoices", description: "View client invoices (Client Admin only)" },
  { id: 18, permissionName: "pay_invoices", description: "Access payment links for invoices" },
  { id: 19, permissionName: "admin_audio_recordings", description: "View and manage audio call recordings (BPO Admin only)" },
  { id: 20, permissionName: "view_tickets", description: "View and manage support tickets" },
  { id: 21, permissionName: "admin_broadcast", description: "Send announcements and broadcasts (BPO Admin and Client Admin only)" },
  { id: 22, permissionName: "broadcast_announcements", description: "Manage quick broadcast announcements" },
  { id: 23, permissionName: "broadcast_swiper", description: "Manage swiper/carousel content for clients" },
  { id: 24, permissionName: "broadcast_kpi", description: "Manage KPI display content for clients" },
  { id: 25, permissionName: "dashboard_announcements_inbox", description: "View announcements inbox on dashboard" },
  { id: 26, permissionName: "dashboard_master_repository", description: "View master repository on dashboard" },
  { id: 27, permissionName: "dashboard_swiper", description: "View swiper/carousel on dashboard" },
  { id: 28, permissionName: "dashboard_active_tasks", description: "View active tasks on dashboard" },
];

/**
 * Permission sections mapping - used by PermissionsModal to group permissions by feature area
 */
export const permissionSections = {
  dashboard: ["view_dashboard", "admin_dashboard_config", "dashboard_announcements_inbox", "dashboard_master_repository", "dashboard_swiper", "dashboard_active_tasks"],
  reporting: ["view_reporting"],
  audioRetrieval: ["view_interactions", "admin_audio_recordings", "download_audio_files"],
  knowledgeBase: ["view_knowledge_base", "create_kb_articles", "edit_kb_articles"],
  tickets: ["view_tickets"],
  financial: ["view_financials"],
  reportsManagement: ["admin_reports", "download_reports"],
  userManagement: ["admin_clients", "admin_users", "admin_roles"],
  broadcast: ["admin_broadcast", "broadcast_announcements", "broadcast_swiper", "broadcast_kpi"],
};

/**
 * Parent-child permission mapping
 * Toggling a parent permission also toggles all its children
 */
export const parentChildPermissions = {
  view_dashboard: ["admin_dashboard_config", "dashboard_announcements_inbox", "dashboard_master_repository", "dashboard_swiper", "dashboard_active_tasks"],
  admin_broadcast: ["broadcast_announcements", "broadcast_swiper", "broadcast_kpi"],
};

/**
 * Get permissions for a specific section
 * @param {string} sectionKey - The section key (e.g., 'dashboard', 'reporting')
 * @param {Array} allPermissions - Array of all permissions (from API or fallback)
 * @returns {Array} - Filtered permissions for the section
 */
export const getPermissionsForSection = (sectionKey, allPermissions = permissionList) => {
  const permissionNames = permissionSections[sectionKey] || [];
  return allPermissions.filter((p) => permissionNames.includes(p.permissionName));
};
