import React from "react";
import { Helmet } from "react-helmet-async";

import { Typography } from "@mui/material";

import SignInComponent from "@/components/auth/SignIn";

function SignIn() {
  return (
    <React.Fragment>
      <Helmet title="Admin Sign In" />

      <Typography component="h1" variant="h3" align="center" gutterBottom>
        CruisaPalooza Admin
      </Typography>
      <Typography component="h2" variant="subtitle1" align="center">
        Sign in with your admin account
      </Typography>

      <SignInComponent />
    </React.Fragment>
  );
}

export default SignIn;
