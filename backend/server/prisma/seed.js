import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed...");

  // Create permissions
  const permissions = [
    {
      permissionName: "view_dashboard",
      description: "View dashboard and basic metrics",
    },
    {
      permissionName: "view_financials",
      description: "View financial information and invoices",
    },
    {
      permissionName: "download_invoices",
      description: "Download invoice files",
    },
    { permissionName: "view_reporting", description: "View reports and KPIs" },
    {
      permissionName: "download_reports",
      description: "Download report files",
    },
    {
      permissionName: "view_interactions",
      description: "View interaction history",
    },
    {
      permissionName: "download_audio_files",
      description: "Download audio interaction files",
    },
    {
      permissionName: "view_knowledge_base",
      description: "View knowledge base articles",
    },
    {
      permissionName: "create_kb_articles",
      description: "Create knowledge base articles",
    },
    {
      permissionName: "edit_kb_articles",
      description: "Edit knowledge base articles",
    },
    {
      permissionName: "admin_clients",
      description: "Manage clients (BPO Admin only)",
    },
    {
      permissionName: "admin_users",
      description: "Manage users (BPO Admin only)",
    },
    {
      permissionName: "admin_roles",
      description: "Manage roles and permissions (BPO Admin only)",
    },
    {
      permissionName: "admin_reports",
      description: "Upload and manage client reports (BPO Admin only)",
    },
    {
      permissionName: "admin_dashboard_config",
      description: "Configure dashboard layouts (BPO Admin only)",
    },
    {
      permissionName: "admin_invoices",
      description:
        "Manage invoices - create, send, and set payment links (BPO Admin only)",
    },
    {
      permissionName: "admin_audio_recordings",
      description:
        "View and manage audio call recordings from Workforce Management database (BPO Admin only)",
    },
    {
      permissionName: "view_invoices",
      description: "View client invoices (Client Admin only)",
    },
    {
      permissionName: "pay_invoices",
      description: "Access payment links for invoices",
    },
    {
      permissionName: "view_tickets",
      description: "View and manage support tickets",
    },
    {
      permissionName: "admin_broadcast",
      description: "Send announcements and broadcasts to clients (BPO Admin and Client Admin only)",
    },
    {
      permissionName: "broadcast_announcements",
      description: "Manage quick broadcast announcements",
    },
    {
      permissionName: "broadcast_swiper",
      description: "Manage swiper/carousel content for clients",
    },
    {
      permissionName: "broadcast_kpi",
      description: "Manage KPI display content for clients",
    },
    {
      permissionName: "dashboard_announcements_inbox",
      description: "View announcements inbox on dashboard",
    },
    {
      permissionName: "dashboard_master_repository",
      description: "View master repository on dashboard",
    },
    {
      permissionName: "dashboard_swiper",
      description: "View swiper/carousel on dashboard",
    },
    {
      permissionName: "dashboard_active_tasks",
      description: "View active tasks on dashboard",
    },
  ];

  console.log("Creating permissions...");
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { permissionName: permission.permissionName },
      update: {},
      create: permission,
    });
  }

  // Create BPO Administration client (Super Admin - can see all KB prefixes)
  console.log("Creating BPO Administration client...");
  const bpoClient = await prisma.client.upsert({
    where: { id: 1 },
    update: { kbPrefix: null }, // BPO Admin has access to ALL prefixes
    create: {
      id: 1,
      name: "BPO Administration",
      kbPrefix: null, // null means access to all
      isActive: true,
      isProspect: false,
    },
  });

  // Create Flex Mobile client - PA_US_2
  console.log("Creating Flex Mobile...");
  const flexMobileClient = await prisma.client.upsert({
    where: { id: 2 },
    update: { kbPrefix: "PA_US_2" },
    create: {
      id: 2,
      name: "Flex Mobile",
      kbPrefix: "PA_US_2",
      isActive: true,
      isProspect: false,
    },
  });

  // Create IM Telecom client - PA_US_1
  console.log("Creating IM Telecom...");
  const imTelecomClient = await prisma.client.upsert({
    where: { id: 3 },
    update: { kbPrefix: "PA_US_1" },
    create: {
      id: 3,
      name: "IM Telecom",
      kbPrefix: "PA_US_1",
      isActive: true,
      isProspect: false,
    },
  });

  // Create Tempo Wireless client - PA_US_3
  console.log("Creating Tempo Wireless...");
  const tempoWirelessClient = await prisma.client.upsert({
    where: { id: 4 },
    update: { name: "Tempo Wireless", kbPrefix: "PA_US_3" },
    create: {
      id: 4,
      name: "Tempo Wireless",
      kbPrefix: "PA_US_3",
      isActive: true,
      isProspect: false,
    },
  });

  // Create Wellness Brands client - PA_US_4
  console.log("Creating Wellness Brands...");
  const wellnessBrandsClient = await prisma.client.upsert({
    where: { id: 5 },
    update: { kbPrefix: "PA_US_4" },
    create: {
      id: 5,
      name: "Wellness Brands",
      kbPrefix: "PA_US_4",
      isActive: true,
      isProspect: false,
    },
  });

  // Create BPO Admin role with all permissions
  console.log("Creating BPO Admin role...");
  const bpoAdminRole = await prisma.role.upsert({
    where: {
      clientId_roleName: {
        clientId: bpoClient.id,
        roleName: "BPO Admin",
      },
    },
    update: {},
    create: {
      clientId: bpoClient.id,
      roleName: "BPO Admin",
      description: "Full administrative access to the portal",
    },
  });

  // Create roles for Flex Mobile
  console.log("👤 Creating Flex Mobile Admin role...");
  const flexMobileAdminRole = await prisma.role.upsert({
    where: {
      clientId_roleName: {
        clientId: flexMobileClient.id,
        roleName: "Client Admin",
      },
    },
    update: {},
    create: {
      clientId: flexMobileClient.id,
      roleName: "Client Admin",
      description: "Administrative access for Flex Mobile users",
    },
  });

  console.log("👤 Creating Flex Mobile User role...");
  const flexMobileUserRole = await prisma.role.upsert({
    where: {
      clientId_roleName: {
        clientId: flexMobileClient.id,
        roleName: "Client User",
      },
    },
    update: {},
    create: {
      clientId: flexMobileClient.id,
      roleName: "Client User",
      description: "Basic access for Flex Mobile users",
    },
  });

  // Create roles for IM Telecom
  console.log("👤 Creating IM Telecom Admin role...");
  const imTelecomAdminRole = await prisma.role.upsert({
    where: {
      clientId_roleName: {
        clientId: imTelecomClient.id,
        roleName: "Client Admin",
      },
    },
    update: {},
    create: {
      clientId: imTelecomClient.id,
      roleName: "Client Admin",
      description: "Administrative access for IM Telecom users",
    },
  });

  console.log("👤 Creating IM Telecom User role...");
  const imTelecomUserRole = await prisma.role.upsert({
    where: {
      clientId_roleName: {
        clientId: imTelecomClient.id,
        roleName: "Client User",
      },
    },
    update: {},
    create: {
      clientId: imTelecomClient.id,
      roleName: "Client User",
      description: "Basic access for IM Telecom users",
    },
  });

  // Create roles for Tempo Wireless
  console.log("👤 Creating Tempo Wireless Admin role...");
  const tempoWirelessAdminRole = await prisma.role.upsert({
    where: {
      clientId_roleName: {
        clientId: tempoWirelessClient.id,
        roleName: "Client Admin",
      },
    },
    update: {},
    create: {
      clientId: tempoWirelessClient.id,
      roleName: "Client Admin",
      description: "Administrative access for Tempo Wireless users",
    },
  });

  console.log("👤 Creating Tempo Wireless User role...");
  const tempoWirelessUserRole = await prisma.role.upsert({
    where: {
      clientId_roleName: {
        clientId: tempoWirelessClient.id,
        roleName: "Client User",
      },
    },
    update: {},
    create: {
      clientId: tempoWirelessClient.id,
      roleName: "Client User",
      description: "Basic access for Tempo Wireless users",
    },
  });

  // Create roles for Wellness Brands
  console.log("👤 Creating Wellness Brands Admin role...");
  const wellnessBrandsAdminRole = await prisma.role.upsert({
    where: {
      clientId_roleName: {
        clientId: wellnessBrandsClient.id,
        roleName: "Client Admin",
      },
    },
    update: {},
    create: {
      clientId: wellnessBrandsClient.id,
      roleName: "Client Admin",
      description: "Administrative access for Wellness Brands users",
    },
  });

  console.log("👤 Creating Wellness Brands User role...");
  const wellnessBrandsUserRole = await prisma.role.upsert({
    where: {
      clientId_roleName: {
        clientId: wellnessBrandsClient.id,
        roleName: "Client User",
      },
    },
    update: {},
    create: {
      clientId: wellnessBrandsClient.id,
      roleName: "Client User",
      description: "Basic access for Wellness Brands users",
    },
  });

  // Assign permissions to BPO Admin (all permissions)
  console.log("🔐 Assigning permissions to BPO Admin...");
  const allPermissions = await prisma.permission.findMany();
  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: bpoAdminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: bpoAdminRole.id,
        permissionId: permission.id,
      },
    });
  }

  // Define permission sets
  const clientAdminPermissions = [
    "view_dashboard",
    "dashboard_announcements_inbox",
    "dashboard_master_repository",
    "dashboard_swiper",
    "dashboard_active_tasks",
    "view_financials",
    "download_invoices",
    "view_reporting",
    "download_reports",
    "view_interactions",
    "view_knowledge_base",
    "create_kb_articles",
    "edit_kb_articles",
    "view_invoices",
    "pay_invoices",
    "view_tickets",
    "admin_users",
    "admin_roles",
    "admin_reports",
    "admin_broadcast",
    "broadcast_announcements",
    "broadcast_swiper",
    "broadcast_kpi",
  ];

  const clientUserPermissions = [
    "view_dashboard",
    "dashboard_announcements_inbox",
    "dashboard_master_repository",
    "dashboard_swiper",
    "dashboard_active_tasks",
    "view_interactions",
    "view_knowledge_base",
    "view_reporting",
    "view_tickets",
  ];

  // Function to assign permissions to a role
  async function assignPermissionsToRole(roleId, permissions, roleName) {
    console.log(`🔐 Assigning permissions to ${roleName}...`);

    // First, delete all existing permissions for this role
    await prisma.rolePermission.deleteMany({
      where: { roleId: roleId },
    });

    // Then, assign the new permissions
    for (const permName of permissions) {
      const permission = await prisma.permission.findUnique({
        where: { permissionName: permName },
      });
      if (permission) {
        await prisma.rolePermission.create({
          data: {
            roleId: roleId,
            permissionId: permission.id,
          },
        });
      }
    }
  }

  // Assign permissions to all Client Admin roles
  await assignPermissionsToRole(
    flexMobileAdminRole.id,
    clientAdminPermissions,
    "Flex Mobile Admin"
  );
  await assignPermissionsToRole(
    imTelecomAdminRole.id,
    clientAdminPermissions,
    "IM Telecom Admin"
  );
  await assignPermissionsToRole(
    tempoWirelessAdminRole.id,
    clientAdminPermissions,
    "Tempo Wireless Admin"
  );
  await assignPermissionsToRole(
    wellnessBrandsAdminRole.id,
    clientAdminPermissions,
    "Wellness Brands Admin"
  );

  // Assign permissions to all Client User roles
  await assignPermissionsToRole(
    flexMobileUserRole.id,
    clientUserPermissions,
    "Flex Mobile User"
  );
  await assignPermissionsToRole(
    imTelecomUserRole.id,
    clientUserPermissions,
    "IM Telecom User"
  );
  await assignPermissionsToRole(
    tempoWirelessUserRole.id,
    clientUserPermissions,
    "Tempo Wireless User"
  );
  await assignPermissionsToRole(
    wellnessBrandsUserRole.id,
    clientUserPermissions,
    "Wellness Brands User"
  );

  // Create client folder access mappings for reports
  console.log("📁 Creating client folder access mappings...");

  // Flex Mobile folder access
  await prisma.clientFolderAccess.upsert({
    where: {
      clientId_folderName: {
        clientId: flexMobileClient.id,
        folderName: "flex-mobile",
      },
    },
    update: {},
    create: {
      clientId: flexMobileClient.id,
      folderName: "flex-mobile",
    },
  });

  // IM Telecom folder access
  await prisma.clientFolderAccess.upsert({
    where: {
      clientId_folderName: {
        clientId: imTelecomClient.id,
        folderName: "im-telecom",
      },
    },
    update: {},
    create: {
      clientId: imTelecomClient.id,
      folderName: "im-telecom",
    },
  });

  // Tempo Wireless folder access
  await prisma.clientFolderAccess.upsert({
    where: {
      clientId_folderName: {
        clientId: tempoWirelessClient.id,
        folderName: "tempo-wireless",
      },
    },
    update: {},
    create: {
      clientId: tempoWirelessClient.id,
      folderName: "tempo-wireless",
    },
  });

  // Wellness Brands folder access
  await prisma.clientFolderAccess.upsert({
    where: {
      clientId_folderName: {
        clientId: wellnessBrandsClient.id,
        folderName: "wellness-brands",
      },
    },
    update: {},
    create: {
      clientId: wellnessBrandsClient.id,
      folderName: "wellness-brands",
    },
  });

  // NOTE: Sample invoices removed from seed.
  // Invoices should be created via the upload API so s3Keys match real files in S3.
  console.log("📄 Skipping sample invoices (create via upload API instead).");

  // Create mockup users
  console.log("👥 Creating mockup users...");

  // BPO Admin user (Super Admin - associated with BPO Administration client)
  const bpoAdminPassword = await bcrypt.hash("admin123!", 12);
  await prisma.user.upsert({
    where: { email: "admin@paricus.com" },
    update: {
      clientId: bpoClient.id, // Update to BPO Administration client
      roleId: bpoAdminRole.id,
      passwordHash: bpoAdminPassword,
    },
    create: {
      email: "admin@paricus.com",
      passwordHash: bpoAdminPassword,
      firstName: "System",
      lastName: "Administrator",
      clientId: bpoClient.id, // BPO Administration client
      roleId: bpoAdminRole.id,
      isActive: true,
    },
  });

  // Create Department Responsible Users (BPO Team)
  console.log("Creating department responsible users...");

  const departmentUserPassword = await bcrypt.hash("paricus123!", 12);

  // Reporting - Nicolas Forero
  const reportingUser = await prisma.user.upsert({
    where: { email: "nicolas.forero@paricus.com" },
    update: {
      clientId: bpoClient.id,
      roleId: bpoAdminRole.id,
      passwordHash: departmentUserPassword,
    },
    create: {
      email: "nicolas.forero@paricus.com",
      passwordHash: departmentUserPassword,
      firstName: "Nicolas",
      lastName: "Forero",
      clientId: bpoClient.id,
      roleId: bpoAdminRole.id,
      isActive: true,
    },
  });

  // Billing - Miguel Duran
  const billingUser = await prisma.user.upsert({
    where: { email: "miguel.duran@paricus.com" },
    update: {
      clientId: bpoClient.id,
      roleId: bpoAdminRole.id,
      passwordHash: departmentUserPassword,
    },
    create: {
      email: "miguel.duran@paricus.com",
      passwordHash: departmentUserPassword,
      firstName: "Miguel",
      lastName: "Duran",
      clientId: bpoClient.id,
      roleId: bpoAdminRole.id,
      isActive: true,
    },
  });

  // IT Support - Jhonatan Arias
  const itSupportUser = await prisma.user.upsert({
    where: { email: "jhonatan@paricus.com" },
    update: {
      clientId: bpoClient.id,
      roleId: bpoAdminRole.id,
      passwordHash: departmentUserPassword,
    },
    create: {
      email: "jhonatan@paricus.com",
      passwordHash: departmentUserPassword,
      firstName: "Jhonatan",
      lastName: "Arias",
      clientId: bpoClient.id,
      roleId: bpoAdminRole.id,
      isActive: true,
    },
  });

  // Operations - Diana Olave
  const operationsUser = await prisma.user.upsert({
    where: { email: "diana@paricus.com" },
    update: {
      clientId: bpoClient.id,
      roleId: bpoAdminRole.id,
      passwordHash: departmentUserPassword,
    },
    create: {
      email: "diana@paricus.com",
      passwordHash: departmentUserPassword,
      firstName: "Diana",
      lastName: "Olave",
      clientId: bpoClient.id,
      roleId: bpoAdminRole.id,
      isActive: true,
    },
  });

  // Create Departments
  console.log("Creating departments...");

  await prisma.department.upsert({
    where: { name: "Reporting" },
    update: {
      email: "nicolas.forero@paricus.com",
      responsibleUserId: reportingUser.id,
    },
    create: {
      name: "Reporting",
      email: "nicolas.forero@paricus.com",
      description: "Reports, KPIs, and analytics department",
      responsibleUserId: reportingUser.id,
      isActive: true,
    },
  });

  await prisma.department.upsert({
    where: { name: "Billing" },
    update: {
      email: "miguel.duran@paricus.com",
      responsibleUserId: billingUser.id,
    },
    create: {
      name: "Billing",
      email: "miguel.duran@paricus.com",
      description: "Invoicing and payment department",
      responsibleUserId: billingUser.id,
      isActive: true,
    },
  });

  await prisma.department.upsert({
    where: { name: "IT Support" },
    update: {
      email: "jhonatan@paricus.com",
      responsibleUserId: itSupportUser.id,
    },
    create: {
      name: "IT Support",
      email: "jhonatan@paricus.com",
      description: "Technical support and IT department",
      responsibleUserId: itSupportUser.id,
      isActive: true,
    },
  });

  await prisma.department.upsert({
    where: { name: "Operations" },
    update: {
      email: "diana@paricus.com",
      responsibleUserId: operationsUser.id,
    },
    create: {
      name: "Operations",
      email: "diana@paricus.com",
      description: "Operations and general support department",
      responsibleUserId: operationsUser.id,
      isActive: true,
    },
  });

  console.log("Departments created!");

  // Flex Mobile users
  const flexAdminPassword = await bcrypt.hash("flex123!", 12);
  await prisma.user.upsert({
    where: { email: "admin@flexmobile.com" },
    update: {},
    create: {
      email: "admin@flexmobile.com",
      passwordHash: flexAdminPassword,
      firstName: "Flex",
      lastName: "Administrator",
      clientId: flexMobileClient.id,
      roleId: flexMobileAdminRole.id,
      isActive: true,
    },
  });

  const flexUserPassword = await bcrypt.hash("flexuser123!", 12);
  await prisma.user.upsert({
    where: { email: "user@flexmobile.com" },
    update: {},
    create: {
      email: "user@flexmobile.com",
      passwordHash: flexUserPassword,
      firstName: "Flex",
      lastName: "User",
      clientId: flexMobileClient.id,
      roleId: flexMobileUserRole.id,
      isActive: true,
    },
  });

  // IM Telecom users
  const imAdminPassword = await bcrypt.hash("imtelecom123!", 12);
  await prisma.user.upsert({
    where: { email: "admin@imtelecom.com" },
    update: {},
    create: {
      email: "admin@imtelecom.com",
      passwordHash: imAdminPassword,
      firstName: "IM",
      lastName: "Administrator",
      clientId: imTelecomClient.id,
      roleId: imTelecomAdminRole.id,
      isActive: true,
    },
  });

  const imUserPassword = await bcrypt.hash("imuser123!", 12);
  await prisma.user.upsert({
    where: { email: "user@imtelecom.com" },
    update: {},
    create: {
      email: "user@imtelecom.com",
      passwordHash: imUserPassword,
      firstName: "IM",
      lastName: "User",
      clientId: imTelecomClient.id,
      roleId: imTelecomUserRole.id,
      isActive: true,
    },
  });

  // Tempo Wireless users
  const tempoAdminPassword = await bcrypt.hash("tempo123!", 12);
  await prisma.user.upsert({
    where: { email: "admin@tempowireless.com" },
    update: {},
    create: {
      email: "admin@tempowireless.com",
      passwordHash: tempoAdminPassword,
      firstName: "Tempo",
      lastName: "Administrator",
      clientId: tempoWirelessClient.id,
      roleId: tempoWirelessAdminRole.id,
      isActive: true,
    },
  });

  const tempoUserPassword = await bcrypt.hash("tempouser123!", 12);
  await prisma.user.upsert({
    where: { email: "user@tempowireless.com" },
    update: {},
    create: {
      email: "user@tempowireless.com",
      passwordHash: tempoUserPassword,
      firstName: "Tempo",
      lastName: "User",
      clientId: tempoWirelessClient.id,
      roleId: tempoWirelessUserRole.id,
      isActive: true,
    },
  });

  // Wellness Brands users
  const wellnessAdminPassword = await bcrypt.hash("wellness123!", 12);
  await prisma.user.upsert({
    where: { email: "admin@wellnessbrands.com" },
    update: {},
    create: {
      email: "admin@wellnessbrands.com",
      passwordHash: wellnessAdminPassword,
      firstName: "Wellness",
      lastName: "Administrator",
      clientId: wellnessBrandsClient.id,
      roleId: wellnessBrandsAdminRole.id,
      isActive: true,
    },
  });

  const wellnessUserPassword = await bcrypt.hash("wellnessuser123!", 12);
  await prisma.user.upsert({
    where: { email: "user@wellnessbrands.com" },
    update: {},
    create: {
      email: "user@wellnessbrands.com",
      passwordHash: wellnessUserPassword,
      firstName: "Wellness",
      lastName: "User",
      clientId: wellnessBrandsClient.id,
      roleId: wellnessBrandsUserRole.id,
      isActive: true,
    },
  });

  // Create sample logs
  console.log("Creating sample logs...");

  const sampleLogs = [
    {
      id: uuidv4(),
      timestamp: new Date("2025-12-03T17:12:55Z"),
      userId: "1",
      eventType: "UPDATE",
      entity: "Role",
      description: "Admin updated role permissions for BPO Admin role",
      status: "SUCCESS",
    },
    {
      id: uuidv4(),
      timestamp: new Date("2025-12-03T16:45:30Z"),
      userId: "2",
      eventType: "CREATE",
      entity: "User",
      description: "New user created: user@flexmobile.com",
      status: "SUCCESS",
    },
    {
      id: uuidv4(),
      timestamp: new Date("2025-12-03T15:30:10Z"),
      userId: "1",
      eventType: "DELETE",
      entity: "Client",
      description: "Client deleted by super admin",
      status: "SUCCESS",
    },
    {
      id: uuidv4(),
      timestamp: new Date("2025-12-03T14:15:45Z"),
      userId: "3",
      eventType: "LOGIN",
      entity: "Auth",
      description: "User logged in successfully from web browser",
      status: "SUCCESS",
    },
    {
      id: uuidv4(),
      timestamp: new Date("2025-12-03T13:00:00Z"),
      userId: "2",
      eventType: "UPDATE",
      entity: "Invoice",
      description: "Invoice status updated from pending to paid",
      status: "SUCCESS",
    },
    {
      id: uuidv4(),
      timestamp: new Date("2025-12-03T12:30:22Z"),
      userId: "unknown",
      eventType: "LOGIN",
      entity: "Auth",
      description: "Failed login attempt - invalid credentials for admin@test.com",
      status: "FAILURE",
    },
    {
      id: uuidv4(),
      timestamp: new Date("2025-12-03T11:20:15Z"),
      userId: "1",
      eventType: "CREATE",
      entity: "Role",
      description: "New role created: Custom Manager for Flex Mobile",
      status: "SUCCESS",
    },
    {
      id: uuidv4(),
      timestamp: new Date("2025-12-03T10:05:30Z"),
      userId: "4",
      eventType: "UPDATE",
      entity: "User",
      description: "User profile updated: Changed password",
      status: "SUCCESS",
    },
    {
      id: uuidv4(),
      timestamp: new Date("2025-12-03T09:45:00Z"),
      userId: "1",
      eventType: "DELETE",
      entity: "Permission",
      description: "Attempted to delete system permission",
      status: "FAILURE",
    },
    {
      id: uuidv4(),
      timestamp: new Date("2025-12-03T08:30:10Z"),
      userId: "2",
      eventType: "CREATE",
      entity: "Invoice",
      description: "New invoice created for Flex Mobile - Invoice #INV-2025-001",
      status: "SUCCESS",
    },
  ];

  for (const log of sampleLogs) {
    await prisma.log.create({
      data: log,
    });
  }

  console.log("Sample logs created!");

  console.log("Seed completed successfully!");
  console.log("");
  console.log("Mockup Credentials:");
  console.log("");
  console.log("BPO Administration (KB: ALL):");
  console.log("   Admin: admin@paricus.com / admin123!");
  console.log("");
  console.log("Flex Mobile (KB: PA_US_2):");
  console.log("   Admin: admin@flexmobile.com / flex123!");
  console.log("   User:  user@flexmobile.com / flexuser123!");
  console.log("");
  console.log("IM Telecom (KB: PA_US_1):");
  console.log("   Admin: admin@imtelecom.com / imtelecom123!");
  console.log("   User:  user@imtelecom.com / imuser123!");
  console.log("");
  console.log("Tempo Wireless (KB: PA_US_3):");
  console.log("   Admin: admin@tempowireless.com / tempo123!");
  console.log("   User:  user@tempowireless.com / tempouser123!");
  console.log("");
  console.log("Wellness Brands (KB: PA_US_4):");
  console.log("   Admin: admin@wellnessbrands.com / wellness123!");
  console.log("   User:  user@wellnessbrands.com / wellnessuser123!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
