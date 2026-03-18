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
import { 
  fetchClaudeSpendRange, 
  fetchOpenAISpendRange,
  syncCurrentMonth,
  syncCurrentMonthOpenAI
} from "@/services/financialsService";

const Divider = styled(MuiDivider)(spacing);

function Financials() {
  const theme = useTheme();
  const monthLabels = useMemo(() => getMonthLabels(), []);
  const mockData = useMemo(() => generateMockFinancialData(), []);
  
  const [claudeSpendData, setClaudeSpendData] = useState(null);
  const [openAISpendData, setOpenAISpendData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadClaudeSpend = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchClaudeSpendRange(12);
      
      console.log("🔵 [Expenses] Raw Claude spend data from Firestore:", data);
      console.log("🔵 [Expenses] Current date:", new Date().toISOString());
      
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

  const loadOpenAISpend = async () => {
    try {
      const data = await fetchOpenAISpendRange(12);
      setOpenAISpendData(data);
    } catch (err) {
      console.error("Failed to load OpenAI spend data:", err);
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      // First, sync current month data from APIs
      try {
        console.log("🔵 Auto-syncing current month data...");
        await Promise.all([
          syncCurrentMonth(),
          syncCurrentMonthOpenAI()
        ]);
        console.log("✅ Current month data synced");
      } catch (err) {
        console.error("⚠️ Failed to sync current month data:", err);
        // Continue loading cached data even if sync fails
      }
      
      // Then load all data from Firestore (including newly synced current month)
      await Promise.all([
        loadClaudeSpend(),
        loadOpenAISpend()
      ]);
    };
    
    initializeData();
  }, []);

  const handleSyncComplete = () => {
    loadClaudeSpend();
    loadOpenAISpend();
  };

  // Merge real Claude and OpenAI data with mock data
  const mergedData = useMemo(() => {
    if (!claudeSpendData && !openAISpendData) return mockData;
    
    console.log("🔵 Claude spend data:", claudeSpendData);
    console.log("🔵 OpenAI spend data:", openAISpendData);
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    
    const claudeMonthlyData = claudeSpendData ? claudeSpendData.map(d => d.totalUsd) : Array(12).fill(0);
    // Find the current month in the data array
    const claudeCurrentMonthData = claudeSpendData ? claudeSpendData.find(d => d.year === currentYear && d.month === currentMonth) : null;
    const claudeCurrentMonth = claudeCurrentMonthData?.totalUsd || 0;
    
    const openaiMonthlyData = openAISpendData ? openAISpendData.map(d => d.totalUsd) : Array(12).fill(0);
    const openaiCurrentMonthData = openAISpendData ? openAISpendData.find(d => d.year === currentYear && d.month === currentMonth) : null;
    const openaiCurrentMonth = openaiCurrentMonthData?.totalUsd || 0;
    
    console.log("🔵 Current year/month:", currentYear, currentMonth);
    console.log("🔵 Claude monthly data:", claudeMonthlyData);
    console.log("🔵 Claude current month data:", claudeCurrentMonthData);
    console.log("🔵 Claude current month:", claudeCurrentMonth);
    console.log("🔵 OpenAI monthly data:", openaiMonthlyData);
    console.log("🔵 OpenAI current month:", openaiCurrentMonth);
    
    return {
      ...mockData,
      expenses: {
        ...mockData.expenses,
        claudeCruisNews: {
          monthlyData: claudeMonthlyData,
          currentMonth: claudeCurrentMonth,
        },
        chatGPTImageCreation: {
          monthlyData: openaiMonthlyData,
          currentMonth: openaiCurrentMonth,
        },
      },
    };
  }, [mockData, claudeSpendData, openAISpendData]);

  const expenseCategories = [
    {
      key: "firebaseRTDB",
      name: "Firebase RTDB Spend",
      data: Array(12).fill(0),
      currentMonthValue: 0,
      color: theme.palette.error.main,
    },
    {
      key: "firebaseFirestore",
      name: "Firebase Firestore Spend",
      data: Array(12).fill(0),
      currentMonthValue: 0,
      color: theme.palette.error.main,
    },
    {
      key: "cloudflareR2",
      name: "Cloudflare R2 Spend",
      data: Array(12).fill(0),
      currentMonthValue: 0,
      color: theme.palette.error.main,
    },
    {
      key: "firebaseHosting",
      name: "Firebase Hosting Spend",
      data: Array(12).fill(0),
      currentMonthValue: 0,
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
      name: "OpenAI API Spend (Image Creation)",
      data: mergedData.expenses.chatGPTImageCreation.monthlyData,
      currentMonthValue: mergedData.expenses.chatGPTImageCreation.currentMonth,
      color: theme.palette.error.main,
    },
    {
      key: "mapboxUsage",
      name: "Mapbox Usage Spend",
      data: Array(12).fill(0),
      currentMonthValue: 0,
      color: theme.palette.error.main,
    },
    {
      key: "mapboxStaticSnapshot",
      name: "Mapbox Static Snapshot Spend",
      data: Array(12).fill(0),
      currentMonthValue: 0,
      color: theme.palette.error.main,
    },
    {
      key: "windsurfDevelopment",
      name: "Windsurf Development Spend",
      data: Array(12).fill(0),
      currentMonthValue: 0,
      color: theme.palette.error.main,
    },
  ];

  const revenueCategories = [
    {
      key: "adMobAds",
      name: "AdMob Ads Revenue",
      data: Array(12).fill(0),
      currentMonthValue: 0,
      color: theme.palette.success.main,
    },
    {
      key: "sponsorship",
      name: "Sponsorship Revenue",
      data: Array(12).fill(0),
      currentMonthValue: 0,
      color: theme.palette.success.main,
    },
    {
      key: "merchandise",
      name: "Merchandise Revenue",
      data: Array(12).fill(0),
      currentMonthValue: 0,
      color: theme.palette.success.main,
    },
  ];

  // Calculate aggregates from actual category data
  const aggregates = useMemo(() => {
    const monthlyExpenses = [];
    const monthlyRevenue = [];
    
    // Calculate totals for each month
    for (let i = 0; i < 12; i++) {
      let expenseTotal = 0;
      let revenueTotal = 0;
      
      // Sum all expenses for this month
      expenseCategories.forEach(category => {
        expenseTotal += category.data[i] || 0;
      });
      
      // Sum all revenue for this month
      revenueCategories.forEach(category => {
        revenueTotal += category.data[i] || 0;
      });
      
      monthlyExpenses.push(Math.round(expenseTotal * 100) / 100);
      monthlyRevenue.push(Math.round(revenueTotal * 100) / 100);
    }
    
    return {
      expenses: monthlyExpenses,
      revenue: monthlyRevenue
    };
  }, [claudeSpendData, openAISpendData]);

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
      <SyncControls onSyncComplete={handleSyncComplete} />

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
