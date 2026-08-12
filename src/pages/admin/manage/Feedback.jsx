import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Box, Tab, Tabs } from "@mui/material";
import UserReportingTab from "./UserReportingTab";
import FeedbackCommentsTab from "./FeedbackCommentsTab";

function Feedback() {
  const [tab, setTab] = useState(0);

  return (
    <React.Fragment>
      <Helmet title="Feedback" />
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)}>
          <Tab label="User Reporting" />
          <Tab label="Comments" />
        </Tabs>
      </Box>
      {tab === 0 && <UserReportingTab />}
      {tab === 1 && <FeedbackCommentsTab />}
    </React.Fragment>
  );
}

export default Feedback;
