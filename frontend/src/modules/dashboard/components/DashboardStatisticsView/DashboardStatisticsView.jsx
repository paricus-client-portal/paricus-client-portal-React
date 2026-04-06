import PropTypes from "prop-types";
import { Box, Chip, Card, CardContent, Typography } from "@mui/material";
import {
  AttachMoney,
  Percent,
  Autorenew,
  PhonelinkErase,
  TrendingUp,
  TrendingDown,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useOutletContext } from "react-router-dom";
import { useSelector } from "react-redux";
import { dashboardStyles, colors } from "../../../../common/styles/styles";
import { useGetClientKpisQuery } from "../../../../store/api/dashboardApi";
import { LoadingProgress } from "../../../../common/components/ui/LoadingProgress";

const KPI_ICONS = {
  total_claim_amount: <AttachMoney />,
  eligible_pct: <Percent />,
  recertification_rate: <Autorenew />,
  non_usage_rate: <PhonelinkErase />,
};

const KPI_I18N_KEYS = {
  total_claim_amount: "dashboard.kpis.totalClaimAmount",
  eligible_pct: "dashboard.kpis.eligiblePct",
  recertification_rate: "dashboard.kpis.recertificationRate",
  non_usage_rate: "dashboard.kpis.nonUsageRate",
};

const formatValue = (value, format) => {
  if (format === "currency") {
    return `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (format === "percent") {
    return `${Number(value).toFixed(1)}%`;
  }
  if (format === "number") {
    return Number(value).toLocaleString();
  }
  return String(value);
};

const formatChange = (change, format) => {
  const num = Number(change);
  const sign = num > 0 ? "+" : "";
  if (format === "percent") return `${sign}${num.toFixed(2)}%`;
  if (format === "pp") return `${sign}${num.toFixed(1)}%`;
  return `${sign}${num}`;
};

/**
 * StatCard - Displays a single KPI metric with change indicator
 */
const StatCard = ({ icon, value, label, badge, positive, badgeTooltip }) => {
  const badgeColor = positive
    ? { backgroundColor: colors.primaryLight, color: colors.primary }
    : {
        backgroundColor: colors.priorityStyles.high.backgroundColor,
        color: colors.priorityStyles.high.color,
      };

  return (
    <Card sx={dashboardStyles.dashboardStatsCard}>
      <CardContent
        sx={{
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <Box
            sx={{
              ...dashboardStyles.dashboardIconContainer,
              mb: 2,
            }}
          >
            {icon}
          </Box>
          {/* Mobile value */}
          <Box
            sx={{
              display: { xs: "flex", md: "none" },
              flexDirection: "column",
            }}
          >
            <Typography
              variant="h4"
              fontWeight="bold"
              sx={{
                color: colors.textPrimary,
                mb: 0.5,
                fontSize: { xs: "1.5rem", md: "1.75rem" },
              }}
            >
              {value}
            </Typography>
            <Typography sx={{ ...dashboardStyles.dashboardMicroLabel, mb: 2 }}>
              {label}
            </Typography>
          </Box>
          {badge && (
            <Box sx={{ mt: 1, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <Chip
                label={badge}
                size="small"
                icon={
                  positive ? (
                    <TrendingUp sx={{ fontSize: "0.9rem" }} />
                  ) : (
                    <TrendingDown sx={{ fontSize: "0.9rem" }} />
                  )
                }
                sx={{
                  fontSize: { xs: "0.5rem", md: "0.8rem" },
                  fontWeight: "bold",
                  borderRadius: "1rem",
                  ...badgeColor,
                }}
              />
              {badgeTooltip && (
                <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, fontSize: "0.65rem", textAlign: "right" }}>
                  {badgeTooltip}
                </Typography>
              )}
            </Box>
          )}
        </Box>
        {/* Desktop value */}
        <Box
          sx={{
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
          }}
        >
          <Typography
            variant="h4"
            fontWeight="bold"
            sx={{
              color: colors.textPrimary,
              mb: 0.5,
              fontSize: { xs: "1.5rem", md: "1.75rem" },
            }}
          >
            {value}
          </Typography>
          <Typography sx={{ ...dashboardStyles.dashboardMicroLabel, mb: 2 }}>
            {label}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

StatCard.propTypes = {
  icon: PropTypes.node.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  label: PropTypes.string.isRequired,
  badge: PropTypes.string,
  positive: PropTypes.bool,
  badgeTooltip: PropTypes.string,
};

export const DashboardStatisticsView = () => {
  const { t } = useTranslation();
  const { selectedClientId = null } = useOutletContext() || {};
  const user = useSelector((state) => state.auth?.user);
  const permissions = useSelector((state) => state.auth?.permissions);
  const isBPOAdmin = permissions?.includes("admin_clients") ?? false;

  // BPO Admin without a selected client: don't show KPIs
  const skipQuery = isBPOAdmin && !selectedClientId;
  const queryClientId = isBPOAdmin ? selectedClientId : undefined;

  const {
    data: kpiData,
    isLoading,
    error,
  } = useGetClientKpisQuery(queryClientId, { skip: skipQuery });

  const kpis = kpiData?.kpis || [];

  if (skipQuery || kpis.length === 0) {
    return null;
  }

  if (isLoading) {
    return (
      <Box sx={{ textAlign: "center", py: 4 }}>
        <LoadingProgress size={32} />
      </Box>
    );
  }

  if (kpis.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 4 }}>
        <Typography variant="body2" color="text.secondary">
          {t("dashboard.statistics.noKpis")}
        </Typography>
      </Box>
    );
  }

  const getComparisonTooltip = (kpi) => {
    const meta = kpi.meta || {};
    if (meta.prevName) return `${t("dashboard.kpis.vsTooltip")} ${meta.prevName}`;
    if (meta.prevMonth) return `${t("dashboard.kpis.vsTooltip")} ${meta.prevMonth}`;
    return "";
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: `repeat(${Math.min(kpis.length, 4)}, 1fr)`,
          },
          gap: 3,
          mb: 1,
        }}
      >
        {kpis.map((kpi) => (
          <StatCard
            key={kpi.id}
            icon={KPI_ICONS[kpi.id] || <TrendingUp />}
            value={formatValue(kpi.value, kpi.format)}
            label={KPI_I18N_KEYS[kpi.id] ? t(KPI_I18N_KEYS[kpi.id]) : kpi.label}
            badge={formatChange(kpi.change, kpi.changeFormat)}
            positive={Number(kpi.change) >= 0}
            badgeTooltip={getComparisonTooltip(kpi)}
          />
        ))}
      </Box>
      <Typography variant="caption" color="text.disabled" sx={{ display: "block", textAlign: "right" }}>
        {t("dashboard.kpis.lastUpdated")}: {new Date().toLocaleDateString()}
      </Typography>
    </Box>
  );
};
