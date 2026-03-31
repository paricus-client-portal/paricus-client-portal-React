import { createSlice } from "@reduxjs/toolkit";

export const defaultKpis = {
  callsOffered: {
    value: 1482,
    target: 1300,
    change: "+12.5%",
  },
  callsAnswered: {
    value: 1314,
    target: 1200,
    change: "+8.2%",
  },
  answerRate: {
    value: 88.6,
    target: 85,
    change: "+2.4%",
  },
  slaCompliance: {
    value: 99.4,
    target: 95,
    change: "EXCELLENT",
  },
};

// Random KPI data per user (simulated)
// Keys are user IDs from the seed data
export const userKpis = {
  // Flex Mobile users
  2: { // admin@flexmobile.com
    callsOffered: { value: 2150, target: 2000, change: "+7.5%" },
    callsAnswered: { value: 1980, target: 1800, change: "+10.0%" },
    answerRate: { value: 92.1, target: 90, change: "+2.1%" },
    slaCompliance: { value: 97.3, target: 95, change: "GOOD" },
  },
  3: { // user@flexmobile.com
    callsOffered: { value: 870, target: 1000, change: "-13.0%" },
    callsAnswered: { value: 720, target: 900, change: "-20.0%" },
    answerRate: { value: 82.8, target: 85, change: "-2.2%" },
    slaCompliance: { value: 89.5, target: 95, change: "NEEDS IMPROVEMENT" },
  },
  // IM Telecom users
  4: { // admin@imtelecom.com
    callsOffered: { value: 3200, target: 3000, change: "+6.7%" },
    callsAnswered: { value: 2950, target: 2700, change: "+9.3%" },
    answerRate: { value: 92.2, target: 88, change: "+4.2%" },
    slaCompliance: { value: 98.1, target: 95, change: "EXCELLENT" },
  },
  5: { // user@imtelecom.com
    callsOffered: { value: 1100, target: 1200, change: "-8.3%" },
    callsAnswered: { value: 950, target: 1050, change: "-9.5%" },
    answerRate: { value: 86.4, target: 90, change: "-3.6%" },
    slaCompliance: { value: 91.2, target: 95, change: "BELOW TARGET" },
  },
  // North American Local users
  6: { // admin@northamericanlocal.com
    callsOffered: { value: 1750, target: 1500, change: "+16.7%" },
    callsAnswered: { value: 1620, target: 1400, change: "+15.7%" },
    answerRate: { value: 92.6, target: 90, change: "+2.6%" },
    slaCompliance: { value: 99.1, target: 95, change: "EXCELLENT" },
  },
  7: { // user@northamericanlocal.com
    callsOffered: { value: 680, target: 800, change: "-15.0%" },
    callsAnswered: { value: 540, target: 700, change: "-22.9%" },
    answerRate: { value: 79.4, target: 85, change: "-5.6%" },
    slaCompliance: { value: 84.7, target: 95, change: "CRITICAL" },
  },
};

const loadFromStorage = () => {
  try {
    const saved = localStorage.getItem("kpiData");
    return saved ? JSON.parse(saved) : defaultKpis;
  } catch {
    return defaultKpis;
  }
};

const saveToStorage = (plainState) => {
  try {
    localStorage.setItem("kpiData", JSON.stringify(plainState));
  } catch { /* localStorage unavailable */ }
};

// Returns true if actual value meets or exceeds the target
export const isTargetAchieved = (value, target) => {
  return Number(value) >= Number(target);
};

const kpiSlice = createSlice({
  name: "kpi",
  initialState: loadFromStorage(),
  reducers: {
    // Save all KPIs at once - return new state to guarantee Redux detects the change
    setAllKpis: (_, action) => {
      const newState = action.payload;
      saveToStorage(newState);
      return newState;
    },
    resetKpis: () => {
      saveToStorage(defaultKpis);
      return defaultKpis;
    },
  },
});

export const { setAllKpis, resetKpis } = kpiSlice.actions;
export const kpiReducer = kpiSlice.reducer;
