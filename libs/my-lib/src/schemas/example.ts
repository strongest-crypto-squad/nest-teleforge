export type TgCtx = any;
export type Predicate = (ctx: TgCtx) => boolean | Promise<boolean>;
export interface MenuSchema {
  key: string;
  value?: string;
  description?: string;
  order?: number;
  back?: boolean;
  guard?: Predicate | Predicate[];
  disabled?: Predicate | Predicate[];
  disabledText?: string;
  hidden?: boolean;
  layout?: { columns?: number };
  command?: string;
  c?: Record<string, MenuSchema>;
}
const isAdmin: Predicate = (ctx) => ctx.user?.isAdmin === true;
const isPaid: Predicate = (ctx) => ctx.user?.paid === true;
const notPaid: Predicate = (ctx) => !ctx.user?.paid;
export const EXAMPLE_SCHEMA: MenuSchema = {
  key: "main",
  command: "/menu",
  back: false,
  value: "Главное меню",
  description: "Выберите раздел ниже.",
  c: {
    home: {
      key: "main.home",
      value: "🏠 Домой",
      description: "Домашний экран.",
      c: {
        profile: {
          key: "main.home.profile",
          value: "👤 Профиль",
          description: "Ваши данные и настройки профиля.",
          order: 10,
          c: {
            view: {
              key: "main.home.profile.view",
              value: "Посмотреть профиль",
              description: "Здесь будут ваши данные.",
              order: 10,
            },
          },
        },
        neProfile: {
          key: "main.home.neProfile",
          value: "👤 Профиль",
          description: "Ваши данные и настройки профиля.",
          order: 10,
        },
        settings: {
          key: "main.home.settings",
          value: "⚙️ Настройки",
          description: "Общие параметры аккаунта.",
          order: 20,
          c: {
            notifications: {
              key: "main.home.settings.notifications",
              value: "Уведомления",
              description: "Включить/выключить уведомления.",
              order: 10,
            },
            proFeature: {
              key: "main.home.settings.proFeature",
              value: "PRO-функция",
              description: "Доступно на платном плане.",
              order: 20,
              disabled: notPaid,
              disabledText: "Эта функция доступна на платном плане.",
            },
          },
        },
        admin: {
          key: "main.home.admin",
          value: "🛡️ Админ",
          description: "Администраторский раздел.",
          order: 30,
          guard: [isAdmin, isPaid],
          c: {
            dashboard: {
              key: "main.home.admin.dashboard",
              value: "Панель",
              description: "Статистика и управление.",
              order: 10,
            },
          },
        },
      },
    },
  },
};
