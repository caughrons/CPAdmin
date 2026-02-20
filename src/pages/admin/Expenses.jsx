import React from "react";
import { Helmet } from "react-helmet-async";
import Placeholder from "./Placeholder";

function Expenses() {
  return (
    <React.Fragment>
      <Helmet title="Expenses" />
      <Placeholder title="Expenses" />
    </React.Fragment>
  );
}

export default Expenses;
