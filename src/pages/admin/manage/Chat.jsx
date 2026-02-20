import React from "react";
import { Helmet } from "react-helmet-async";
import Placeholder from "../Placeholder";

function Chat() {
  return (
    <React.Fragment>
      <Helmet title="Chat" />
      <Placeholder title="Chat" />
    </React.Fragment>
  );
}

export default Chat;
