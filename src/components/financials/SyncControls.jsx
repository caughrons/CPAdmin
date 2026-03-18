import React, { useState } from "react";
import styled from "@emotion/styled";
import {
  Button,
  CircularProgress,
  Alert,
  Box,
  Typography,
} from "@mui/material";
import { spacing } from "@mui/system";
import { Cloud, RefreshCw } from "lucide-react";
import {
  syncHistoricalClaudeSpend,
  syncCurrentMonth,
  syncHistoricalOpenAISpend,
  syncCurrentMonthOpenAI,
} from "@/services/financialsService";

const Container = styled(Box)(spacing);

const ButtonGroup = styled(Box)`
  display: flex;
  gap: ${(props) => props.theme.spacing(2)};
  margin-bottom: ${(props) => props.theme.spacing(2)};
`;

const SyncControls = ({ onSyncComplete }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleHistoricalSync = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Sync both Claude and OpenAI in parallel
      const [claudeResult, openaiResult] = await Promise.allSettled([
        syncHistoricalClaudeSpend(),
        syncHistoricalOpenAISpend(),
      ]);

      const claudeSuccess = claudeResult.status === "fulfilled";
      const openaiSuccess = openaiResult.status === "fulfilled";

      if (claudeSuccess && openaiSuccess) {
        setSuccess(`Successfully synced 3 months of data for both Claude and OpenAI`);
      } else if (claudeSuccess) {
        setSuccess(`Claude synced successfully. OpenAI sync failed: ${openaiResult.reason?.message || "Unknown error"}`);
      } else if (openaiSuccess) {
        setSuccess(`OpenAI synced successfully. Claude sync failed: ${claudeResult.reason?.message || "Unknown error"}`);
      } else {
        throw new Error("Both providers failed to sync");
      }

      console.log("Historical sync results:", { claudeResult, openaiResult });

      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (err) {
      console.error("Historical sync error:", err);
      console.error("Error details:", JSON.stringify(err, null, 2));
      const errorMessage = err.message || err.code || "Failed to sync historical data";
      setError(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCurrentMonthSync = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Sync both Claude and OpenAI in parallel
      const [claudeResult, openaiResult] = await Promise.allSettled([
        syncCurrentMonth(),
        syncCurrentMonthOpenAI(),
      ]);

      const claudeSuccess = claudeResult.status === "fulfilled" && claudeResult.value?.success;
      const openaiSuccess = openaiResult.status === "fulfilled" && openaiResult.value?.success;

      const claudeTotal = claudeSuccess ? claudeResult.value.data?.totalUsd?.toFixed(2) || "0.00" : "Error";
      const openaiTotal = openaiSuccess ? openaiResult.value.data?.totalUsd?.toFixed(2) || "0.00" : "Error";

      if (claudeSuccess && openaiSuccess) {
        setSuccess(
          `Current month refreshed - Claude: $${claudeTotal}, OpenAI: $${openaiTotal}`
        );
      } else if (claudeSuccess) {
        setSuccess(
          `Claude: $${claudeTotal} (OpenAI failed: ${openaiResult.reason?.message || "Unknown error"})`
        );
      } else if (openaiSuccess) {
        setSuccess(
          `OpenAI: $${openaiTotal} (Claude failed: ${claudeResult.reason?.message || "Unknown error"})`
        );
      } else {
        throw new Error("Both providers failed to refresh");
      }

      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (err) {
      console.error("Current month sync error:", err);
      setError(err.message || "Failed to refresh current month data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container mb={4}>
      <Typography variant="h5" gutterBottom>
        API Data Management
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Sync spend data from Claude (Anthropic) and OpenAI APIs
      </Typography>

      <ButtonGroup mt={3}>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={20} /> : <Cloud />}
          onClick={handleHistoricalSync}
          disabled={loading}
        >
          Sync Historical Data (All Providers, 3 months)
        </Button>

        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={20} /> : <RefreshCw />}
          onClick={handleCurrentMonthSync}
          disabled={loading}
        >
          Refresh Current Month (All Providers)
        </Button>
      </ButtonGroup>

      {success && (
        <Alert severity="success" sx={{ mt: 2 }}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Container>
  );
};

export default SyncControls;
