import { MenuNode, Predicate } from "libs/my-lib/src/features/menu/menu.types";

const isAdmin: Predicate = (ctx) => ctx.user?.isAdmin === true;
const isPaid: Predicate = (ctx) => ctx.user?.paid === true;
const notPaid: Predicate = (ctx) => !ctx.user?.paid;

export const PLAYGROUND_MENU_SCHEMA: MenuNode = {
  key: "main",
  command: "/menu",
  back: false,
  value: "Main menu",
  description: "Choose a section below.",
  c: {
    home: {
      key: "main.home",
      value: "🏠 Home",
      description: "Home screen.",
      c: {
        profile: {
          key: "main.home.profile",
          value: "👤 Profile",
          description: "Your profile data and settings.",
          order: 10,
          c: {
            view: {
              key: "main.home.profile.view",
              value: "View profile",
              description: "Your profile details appear here.",
              order: 10,
            },
          },
        },
        neProfile: {
          key: "main.home.neProfile",
          value: "👤 Profile",
          description: "Your profile data and settings.",
          order: 10,
        },
        settings: {
          key: "main.home.settings",
          value: "⚙️ Settings",
          description: "General account settings.",
          order: 20,
          c: {
            notifications: {
              key: "main.home.settings.notifications",
              value: "Notifications",
              description: "Enable or disable notifications.",
              order: 10,
            },
            proFeature: {
              key: "main.home.settings.proFeature",
              value: "PRO feature",
              description: "Available on a paid plan.",
              order: 20,
              disabled: notPaid,
              disabledText: "This feature is available on a paid plan.",
            },
          },
        },
        admin: {
          key: "main.home.admin",
          value: "🛡️ Admin",
          description: "Administrator section.",
          order: 30,
          guard: [isAdmin, isPaid],
          c: {
            dashboard: {
              key: "main.home.admin.dashboard",
              value: "Dashboard",
              description: "Stats and management.",
              order: 10,
            },
          },
        },
      },
    },
  },
};
