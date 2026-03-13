import React, { useMemo, useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import styled from "@emotion/styled";
import { useTheme } from "@mui/material/styles";

import { Divider as MuiDivider, Grid, Typography, CircularProgress, Alert } from "@mui/material";
import { spacing } from "@mui/system";

import AggregateChart from "@/components/financials/AggregateChart";
import CategoryRow from "@/components/financials/CategoryRow";
import SyncControls from "@/components/financials/SyncControls";
import {
  generateMockFinancialData,
  calculateAggregates,
  getMonthLabels,
} from "@/utils/mockFinancialData";
import { fetchClaudeSpendRange } from "@/services/financialsService";

const Divider = styled(MuiDivider)(spacing);

function Financials() {
  const theme = useTheme();
  const monthLabels = useMemo(() => getMonthLabels(), []);
  const mockData = useMemo(() => generateMockFinancialData(), []);
  
  const [claudeSpendData, setClaudeSpendData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadClaudeSpend = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchClaudeSpendRange(12);
      
      // Check if we got any real data
      const hasRealData = data && data.some(d => d.totalUsd > 0);
      
      if (!hasRealData) {
        setError("No Claude spend data available yet. Click 'Sync Historical Data' to fetch from Anthropic API.");
      }
      
      setClaudeSpendData(data);
    } catch (err) {
      console.error("Failed to load Claude spend data:", err);
      setError("Unable to load Claude spend data. Click 'Sync Historical Data' to fetch from Anthropic API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClaudeSpend();
  }, []);

  // Merge real Claude data with mock data
  const mergedData = useMemo(() => {
    if (!claudeSpendData) return mockData;
    
    console.log("🔵 Claude spend data:", claudeSpendData);
    const monthlyData = claudeSpendData.map(d => d.totalUsd);
    const currentMonth = claudeSpendData[claudeSpendData.length - 1]?.totalUsd || 0;
    console.log("🔵 Monthly data:", monthlyData);
    console.log("🔵 Current month:", currentMonth);
    
    return {
      ...mockData,
      expenses: {
        ...mockData.expenses,
        claudeCruisNews: {
          monthlyData,
          currentMonth,
        },
      },
    };
  }, [mockData, claudeSpendData]);

  const aggregates = useMemo(() => calculateAggregates(mergedData), [mergedData]);

  const expenseCategories = [
    {
      key: "firebaseRTDB",
      name: "Firebase RTDB Spend",
      data: mockData.expenses.firebaseRTDB.monthlyData,
      currentMonthValue: mockData.expenses.firebaseRTDB.currentMonth,
      color: theme.palette.error.main,
    },
    {
      key: "firebaseFirestore",
      name: "Firebase Firestore Spend",
      data: mockData.expenses.firebaseFirestore.monthlyData,
      currentMonthValue: mockData.expenses.firebaseFirestore.currentMonth,
      color: theme.palette.error.main,
    },
    {
      key: "cloudflareR2",
      name: "Cloudflare R2 Spend",
      data: mockData.expenses.cloudflareR2.monthlyData,
      currentMonthValue: mockData.expenses.cloudflareR2.currentMonth,
      color: theme.palette.error.main,
    },
    {
      key: "firebaseHosting",
      name: "Firebase Hosting Spend",
      data: mockData.expenses.firebaseHosting.monthlyData,
      currentMonthValue: mockData.expenses.firebaseHosting.currentMonth,
      color: theme.palette.error.main,
    },
    {
      key: "claudeCruisNews",
      name: "Claude CruisNews Spend",
      data: mergedData.expenses.claudeCruisNews.monthlyData,
      currentMonthValue: mergedData.expenses.claudeCruisNews.currentMonth,
      color: theme.palette.error.main,
    },
    {
      key: "chatGPTImageCreation",
      name: "ChatGPT Image Creation Spend",
      data: mergedData.expenses.chatGPTImageCreation.monthlyData,
      currentMonthValue: mergedData.expenses.chatGPTImageCreation.currentMonth,
      color: theme.palette.error.main,
    },
    {
      key: "windsurfDevelopment",
      name: "Windsurf Development Spend",
      data: mergedData.expenses.windsurfDevelopment.monthlyData,
      currentMonthValue: mergedData.expenses.windsurfDevelopment.currentMonth,
      color: theme.palette.error.main,
    },
  ];

  const revenueCategories = [
    {
      key: "adMobAds",
      name: "AdMob Ads Revenue",
      data: mockData.revenue.adMobAds.monthlyData,
      currentMonthValue: mockData.revenue.adMobAds.currentMonth,
      color: theme.palette.success.main,
    },
    {
      key: "sponsorship",
      name: "Sponsorship Revenue",
      data: mockData.revenue.sponsorship.monthlyData,
      currentMonthValue: mockData.revenue.sponsorship.currentMonth,
      color: theme.palette.success.main,
    },
    {
      key: "merchandise",
      name: "Merchandise Revenue",
      data: mockData.revenue.merchandise.monthlyData,
      currentMonthValue: mockData.revenue.merchandise.currentMonth,
      color: theme.palette.success.main,
    },
  ];

  return (
    <React.Fragment>
      <Helmet title="Financials" />

      <Typography variant="h3" gutterBottom>
        Financials
      </Typography>
      <Typography variant="subtitle1" color="text.secondary">
        Revenue and expense tracking
      </Typography>

      <Divider my={6} />

      {/* Data Management Controls */}
      <SyncControls onSyncComplete={loadClaudeSpend} />

      <Divider my={6} />

      {/* Loading State */}
      {loading && (
        <Grid container spacing={6} justifyContent="center">
          <Grid size={12} sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Loading financial data...
            </Typography>
          </Grid>
        </Grid>
      )}

      {/* Error State */}
      {error && !loading && (
        <Alert severity="warning" sx={{ mb: 4 }}>
          {error} - Showing mock data for other categories.
        </Alert>
      )}

      {/* Aggregate Chart */}
      {!loading && (
        <>
          <Grid container spacing={6}>
            <Grid size={12}>
              <AggregateChart
                expenseData={aggregates.expenses}
                revenueData={aggregates.revenue}
                monthLabels={monthLabels}
              />
            </Grid>
          </Grid>

          <Divider my={6} />
        </>
      )}

      {/* Expenses Section */}
      {!loading && (
        <>
          <Typography variant="h4" gutterBottom>
            Expenses
          </Typography>
          <Grid container spacing={3}>
            {expenseCategories.map((category) => (
              <Grid size={12} key={category.key}>
                <CategoryRow {...category} monthLabels={monthLabels} />
              </Grid>
            ))}
          </Grid>

          <Divider my={6} />

          {/* Revenue Section */}
          <Typography variant="h4" gutterBottom>
            Revenue
          </Typography>
          <Grid container spacing={3}>
            {revenueCategories.map((category) => (
              <Grid size={12} key={category.key}>
                <CategoryRow {...category} monthLabels={monthLabels} />
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </React.Fragment>
  );
}

export default Financials;
