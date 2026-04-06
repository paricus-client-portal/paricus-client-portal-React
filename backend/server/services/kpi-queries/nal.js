/**
 * KPI Queries for North American Local (NAL)
 *
 * Each query function receives the MSSQL pool and returns structured KPI data.
 * KPI 1 & 2 share the same query (workfiles).
 * KPI 3: Recertification Campaign Success Rate
 * KPI 4: Non-Usage Success Rate
 */

const WORKFILES_QUERY = `
  WITH latest AS (
    SELECT TOP 1 id, total_amount, record_count, claimable_count, name, claim_month, claim_year
    FROM compliance.workfiles
    ORDER BY claim_year DESC, claim_month DESC, id DESC
  ),
  prev_snapshot AS (
    SELECT TOP 1 id, total_amount, record_count, claimable_count, name, claim_month, claim_year
    FROM compliance.workfiles
    WHERE (workfile_type = 'SNAPSHOT' OR name LIKE '%Snapshot%')
      AND id <> (SELECT id FROM latest)
    ORDER BY claim_year DESC, claim_month DESC, id DESC
  )
  SELECT
    l.total_amount       AS current_amount,
    l.name               AS current_name,
    p.total_amount       AS prev_amount,
    p.name               AS prev_name,
    l.total_amount - p.total_amount AS amount_diff,
    ROUND((l.total_amount - p.total_amount) / NULLIF(p.total_amount, 0) * 100, 2) AS amount_change_pct,
    ROUND(CAST(l.claimable_count AS FLOAT) / NULLIF(l.record_count, 0) * 100, 1) AS current_eligible_pct,
    l.claimable_count    AS current_claimable,
    l.record_count       AS current_records,
    ROUND(CAST(p.claimable_count AS FLOAT) / NULLIF(p.record_count, 0) * 100, 1) AS prev_eligible_pct,
    p.claimable_count    AS prev_claimable,
    p.record_count       AS prev_records,
    ROUND(
      CAST(l.claimable_count AS FLOAT) / NULLIF(l.record_count, 0) * 100
      - CAST(p.claimable_count AS FLOAT) / NULLIF(p.record_count, 0) * 100,
    1) AS eligible_pct_diff
  FROM latest l
  LEFT JOIN prev_snapshot p ON 1=1
`;

const RECERTIFICATION_QUERY = `
  WITH latest_nal AS (
    SELECT etc_general_use AS order_id, recertification_status, recert_method_code,
           ROW_NUMBER() OVER (PARTITION BY etc_general_use ORDER BY load_date DESC) AS rn
    FROM silver_nal.nlad_recertification_status
    WHERE etc_general_use IS NOT NULL
  ),
  eligible AS (
    SELECT rs.order_id, rs.id AS subscriber_id
    FROM compliance.recertification_subscribers rs
    INNER JOIN latest_nal ln ON rs.order_id = ln.order_id AND ln.rn = 1
    WHERE rs.is_active = 1
      AND (
        ln.recertification_status = 'In-Progress'
        OR rs.current_status = 'manually_recertified'
      )
      AND NOT (ln.recertification_status = 'Recertified' AND ln.recert_method_code = 'Auto Recert')
  ),
  eligible_count AS (
    SELECT COUNT(*) AS total FROM eligible
  ),
  recertified_by_month AS (
    SELECT
      FORMAT(h.created_at, 'yyyy-MM') AS month,
      COUNT(DISTINCT e.order_id) AS recertified_count
    FROM compliance.recertification_status_history h
    INNER JOIN eligible e ON h.subscriber_id = e.subscriber_id
    WHERE h.status = 'manually_recertified'
      AND h.created_at IS NOT NULL
    GROUP BY FORMAT(h.created_at, 'yyyy-MM')
  ),
  current_month AS (
    SELECT TOP 1 *,
      ROUND(CAST(recertified_count AS FLOAT) / NULLIF((SELECT total FROM eligible_count), 0) * 100, 1) AS success_rate
    FROM recertified_by_month ORDER BY month DESC
  ),
  prev_month AS (
    SELECT TOP 1 *,
      ROUND(CAST(recertified_count AS FLOAT) / NULLIF((SELECT total FROM eligible_count), 0) * 100, 1) AS success_rate
    FROM recertified_by_month WHERE month < (SELECT month FROM current_month) ORDER BY month DESC
  )
  SELECT
    (SELECT total FROM eligible_count) AS campaign_eligible,
    ISNULL(c.month, FORMAT(GETDATE(), 'yyyy-MM')) AS current_month,
    ISNULL(c.recertified_count, 0) AS current_recertified,
    ISNULL(c.success_rate, 0) AS current_success_rate,
    p.month             AS prev_month,
    ISNULL(p.recertified_count, 0) AS prev_recertified,
    ISNULL(p.success_rate, 0) AS prev_success_rate,
    ISNULL(c.success_rate, 0) - ISNULL(p.success_rate, 0) AS rate_diff
  FROM (SELECT 1 AS dummy) d
  LEFT JOIN current_month c ON 1=1
  LEFT JOIN prev_month p ON 1=1
`;

const NON_USAGE_QUERY = `
  WITH monthly_stats AS (
    SELECT
      FORMAT(sn.created_at, 'yyyy-MM') AS month,
      COUNT(DISTINCT sn.subscriber_id) AS total_notified,
      COUNT(DISTINCT CASE
        WHEN sm.subscriber_id IS NOT NULL THEN sm.subscriber_id
      END) AS recovered
    FROM compliance.subscriber_notifications sn
    LEFT JOIN compliance.subscriber_movements sm
      ON sn.subscriber_id = sm.subscriber_id
      AND sm.from_category = 'LIST'
      AND sm.to_category IN ('RECENT_USAGE', 'ACTIVE')
      AND sm.moved_at >= sn.created_at
    WHERE sn.created_at IS NOT NULL
    GROUP BY FORMAT(sn.created_at, 'yyyy-MM')
  ),
  current_month AS (
    SELECT TOP 1 *,
      ROUND(CAST(recovered AS FLOAT) / NULLIF(total_notified, 0) * 100, 1) AS success_rate
    FROM monthly_stats ORDER BY month DESC
  ),
  prev_month AS (
    SELECT TOP 1 *,
      ROUND(CAST(recovered AS FLOAT) / NULLIF(total_notified, 0) * 100, 1) AS success_rate
    FROM monthly_stats WHERE month < (SELECT month FROM current_month) ORDER BY month DESC
  )
  SELECT
    c.month            AS current_month,
    c.total_notified   AS current_notified,
    c.recovered        AS current_recovered,
    c.success_rate     AS current_success_rate,
    p.month            AS prev_month,
    p.total_notified   AS prev_notified,
    p.recovered        AS prev_recovered,
    p.success_rate     AS prev_success_rate,
    c.success_rate - ISNULL(p.success_rate, 0) AS rate_diff
  FROM current_month c
  LEFT JOIN prev_month p ON 1=1
`;

/**
 * Fetch all NAL KPIs from MSSQL
 * @param {object} pool - MSSQL connection pool
 * @returns {Promise<Array>} Array of KPI objects
 */
async function safeQuery(pool, query, label) {
  try {
    const result = await pool.request().query(query);
    return result.recordset[0] || {};
  } catch (err) {
    console.error(`[KPI-NAL] ${label} query failed:`, err.message);
    return null;
  }
}

export async function fetchKpis(pool) {
  const [wf, rc, nu] = await Promise.all([
    safeQuery(pool, WORKFILES_QUERY, 'Workfiles'),
    safeQuery(pool, RECERTIFICATION_QUERY, 'Recertification'),
    safeQuery(pool, NON_USAGE_QUERY, 'Non-Usage'),
  ]);

  const kpis = [];

  if (wf) {
    kpis.push({
      id: 'total_claim_amount',
      label: 'Total Claim Amount',
      value: Math.round(wf.current_amount ?? 0),
      format: 'number',
      change: wf.amount_change_pct ?? 0,
      changeFormat: 'percent',
      diff: wf.amount_diff ?? 0,
      previous: wf.prev_amount ?? 0,
      meta: { prevName: wf.prev_name },
    });
    kpis.push({
      id: 'eligible_pct',
      label: 'Eligible %',
      value: wf.current_eligible_pct ?? 0,
      format: 'percent',
      change: wf.eligible_pct_diff ?? 0,
      changeFormat: 'pp',
      previous: wf.prev_eligible_pct ?? 0,
      meta: {
        prevName: wf.prev_name,
        currentClaimable: wf.current_claimable,
        currentRecords: wf.current_records,
        prevClaimable: wf.prev_claimable,
        prevRecords: wf.prev_records,
      },
    });
  }

  if (rc) {
    kpis.push({
      id: 'recertification_rate',
      label: 'Recertification Success Rate',
      value: rc.current_success_rate ?? 0,
      format: 'percent',
      change: rc.rate_diff ?? 0,
      changeFormat: 'pp',
      previous: rc.prev_success_rate ?? 0,
      meta: {
        eligible: rc.campaign_eligible,
        currentRecertified: rc.current_recertified,
        currentMonth: rc.current_month,
        prevRecertified: rc.prev_recertified,
        prevMonth: rc.prev_month,
      },
    });
  }

  if (nu) {
    kpis.push({
      id: 'non_usage_rate',
      label: 'Non-Usage Success Rate',
      value: nu.current_success_rate ?? 0,
      format: 'percent',
      change: nu.rate_diff ?? 0,
      changeFormat: 'pp',
      previous: nu.prev_success_rate ?? 0,
      meta: {
        currentNotified: nu.current_notified,
        currentRecovered: nu.current_recovered,
        currentMonth: nu.current_month,
        prevNotified: nu.prev_notified,
        prevRecovered: nu.prev_recovered,
        prevMonth: nu.prev_month,
      },
    });
  }

  return kpis;
}
