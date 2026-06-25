import {
  Activity,
  Heart,
  DollarSign,
  ShoppingBag,
  Users,
  Building2,
  Megaphone,
  MessageSquare,
  MapPin,
  Calendar,
  Newspaper,
  Navigation,
  Map,
  MessageCircle,
  Server,
  ShieldAlert,
} from "lucide-react";

const manageSection = [
  {
    href: "/manage/users",
    icon: Users,
    title: "Users",
  },
  {
    href: "/manage/communities",
    icon: Building2,
    title: "Communities",
  },
  {
    href: "/manage/ads",
    icon: Megaphone,
    title: "Ads",
  },
  {
    href: "/manage/feedback",
    icon: MessageSquare,
    title: "Feedback",
  },
  {
    href: "/manage/spots",
    icon: MapPin,
    title: "Spots",
  },
  {
    href: "/manage/rendezvous",
    icon: Calendar,
    title: "Rendezvous",
  },
  {
    href: "/manage/news",
    icon: Newspaper,
    title: "News",
  },
  {
    href: "/manage/waypoints",
    icon: Navigation,
    title: "Waypoints",
  },
  {
    href: "/manage/potential-spam",
    icon: ShieldAlert,
    title: "Potential Spam",
  },
  {
    href: "/manage/map",
    icon: Map,
    title: "Map",
    children: [
      {
        href: "/manage/map/ais",
        title: "AIS",
      },
      {
        href: "/maps/tile-management",
        title: "Tile Management",
      },
    ],
  },
  {
    href: "/manage/chat",
    icon: MessageCircle,
    title: "Chat",
  },
];

const navItems = [
  {
    title: "Overview",
    pages: [
      {
        href: "/activity",
        icon: Activity,
        title: "Activity",
      },
      {
        href: "/health",
        icon: Heart,
        title: "Health",
      },
      {
        href: "/financials",
        icon: DollarSign,
        title: "Financials",
      },
      {
        href: "/ecommerce",
        icon: ShoppingBag,
        title: "Ecommerce",
      },
    ],
  },
  {
    title: "Manage",
    pages: manageSection,
  },
  {
    title: "System",
    pages: [
      {
        href: "/hosting",
        icon: Server,
        title: "Hosting",
      },
    ],
  },
];

export default navItems;
