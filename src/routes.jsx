import React from "react";
import { Navigate } from "react-router-dom";

// Layouts
import AuthLayout from "@/layouts/Auth";
import ErrorLayout from "@/layouts/Error";
import DashboardLayout from "@/layouts/Dashboard";

// Guards
import AuthGuard from "@/components/guards/AuthGuard";

// Auth pages
import SignIn from "@/pages/auth/SignIn";
import ResetPassword from "@/pages/auth/ResetPassword";
import Page403 from "@/pages/auth/Page403";
import Page404 from "@/pages/auth/Page404";
import Page500 from "@/pages/auth/Page500";

// Admin pages — Overview
import Activity from "@/pages/admin/Activity";
import Health from "@/pages/admin/Health";
import Expenses from "@/pages/admin/Expenses";
import Ecommerce from "@/pages/admin/Ecommerce";

// Admin pages — Manage
import Users from "@/pages/admin/manage/Users";
import Partners from "@/pages/admin/manage/Partners";
import Sponsors from "@/pages/admin/manage/Sponsors";
import Ads from "@/pages/admin/manage/Ads";
import Feedback from "@/pages/admin/manage/Feedback";
import Spots from "@/pages/admin/manage/Spots";
import Rendezvous from "@/pages/admin/manage/Rendezvous";
import News from "@/pages/admin/manage/News";
import Waypoints from "@/pages/admin/manage/Waypoints";
import MapAdmin from "@/pages/admin/manage/MapAdmin";
import AIS from "@/pages/admin/manage/AIS";
import AdminChat from "@/pages/admin/manage/Chat";

// Admin pages — System
import Hosting from "@/pages/admin/Hosting";

const AdminLayout = () => (
  <AuthGuard>
    <DashboardLayout />
  </AuthGuard>
);

const routes = [
  {
    path: "/",
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="/activity" replace /> },
      { path: "activity", element: <Activity /> },
      { path: "health", element: <Health /> },
      { path: "expenses", element: <Expenses /> },
      { path: "ecommerce", element: <Ecommerce /> },
      { path: "hosting", element: <Hosting /> },
      {
        path: "manage",
        children: [
          { path: "", element: <Navigate to="/manage/users" replace /> },
          { path: "users", element: <Users /> },
          { path: "partners", element: <Partners /> },
          { path: "sponsors", element: <Sponsors /> },
          { path: "ads", element: <Ads /> },
          { path: "feedback", element: <Feedback /> },
          { path: "spots", element: <Spots /> },
          { path: "rendezvous", element: <Rendezvous /> },
          { path: "news", element: <News /> },
          { path: "waypoints", element: <Waypoints /> },
          { path: "map", element: <MapAdmin /> },
          { path: "map/ais", element: <AIS /> },
          { path: "chat", element: <AdminChat /> },
        ],
      },
    ],
  },
  {
    path: "auth",
    element: <AuthLayout />,
    children: [
      { path: "sign-in", element: <SignIn /> },
      { path: "reset-password", element: <ResetPassword /> },
    ],
  },
  {
    path: "error",
    element: <ErrorLayout />,
    children: [
      { path: "403", element: <Page403 /> },
      { path: "404", element: <Page404 /> },
      { path: "500", element: <Page500 /> },
    ],
  },
  {
    path: "*",
    element: <ErrorLayout />,
    children: [{ path: "*", element: <Page404 /> }],
  },
];

export default routes;
