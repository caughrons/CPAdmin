import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import styled from "@emotion/styled";

import { Divider as MuiDivider, Grid, Typography } from "@mui/material";
import { spacing } from "@mui/system";
import {
  Users,
  Activity as ActivityIcon,
  MessageSquare,
  Newspaper,
  MessageCircle,
} from "lucide-react";

import StatCard from "@/components/StatCard";
import { fetchActivityStats } from "@/services/activityStats";

const Divider = styled(MuiDivider)(spacing);

function Activity() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetchActivityStats()
        .then((data) => {
          if (!cancelled) {
            setStats(data);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            console.error("Activity stats error:", err);
            setError(err.message);
            setLoading(false);
          }
        });
    };

    load();
    const interval = setInterval(load, 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const cards = [
    {
      title: "Registered Users",
      key: "totalUsers",
      chip: "All time",
      icon: Users,
    },
    {
      title: "Active Users",
      key: "activeUsers",
      chip: "Last 10 min",
      icon: ActivityIcon,
    },
    {
      title: "Feed Posts",
      key: "feedPosts24h",
      chip: "Last 24 hrs",
      icon: MessageSquare,
    },
    {
      title: "Active Chats",
      key: "chats24h",
      chip: "Last 24 hrs",
      icon: MessageCircle,
    },
    {
      title: "News Stories",
      key: "newsStories24h",
      chip: "Last 24 hrs",
      icon: Newspaper,
    },
  ];

  return (
    <React.Fragment>
      <Helmet title="Activity" />

      <Typography variant="h3" gutterBottom>
        Activity
      </Typography>
      <Typography variant="subtitle1" color="text.secondary">
        Live platform overview
      </Typography>

      <Divider my={6} />

      <Grid container spacing={6}>
        {cards.map(({ title, key, chip, icon }) => (
          <Grid
            key={key}
            size={{ xs: 12, sm: 6, md: 4, lg: "grow" }}
          >
            <StatCard
              title={title}
              value={stats ? stats[key] : null}
              chip={chip}
              icon={icon}
              loading={loading}
              error={error}
            />
          </Grid>
        ))}
      </Grid>
    </React.Fragment>
  );
}

export default Activity;
