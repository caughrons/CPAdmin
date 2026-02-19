import {
  Activity,
  Heart,
  DollarSign,
  ShoppingBag,
  Users,
  Handshake,
  Star,
  Megaphone,
  MessageSquare,
  MapPin,
  Calendar,
  Newspaper,
  Navigation,
  Map,
  MessageCircle,
  Server,
} from "lucide-react";

const manageSection = [
  {
    href: "/manage/users",
    icon: Users,
    title: "Users",
  },
  {
    href: "/manage/partners",
    icon: Handshake,
    title: "Partners",
  },
  {
    href: "/manage/sponsors",
    icon: Star,
    title: "Sponsors",
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
    href: "/manage/map",
    icon: Map,
    title: "Map",
    children: [
      {
        href: "/manage/map/ais",
        title: "AIS",
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
        href: "/expenses",
        icon: DollarSign,
        title: "Expenses",
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
