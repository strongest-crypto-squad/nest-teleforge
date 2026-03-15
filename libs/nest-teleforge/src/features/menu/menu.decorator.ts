import { SetMetadata } from "@nestjs/common";
import type { MenuSession } from "./menu-session.store";

export const MENU_ACTION_METADATA = "MENU_ACTION";
export type MenuActionResult = "handled" | "rerender" | "rerender-parent";
export type MenuPredicate = (ctx: any) => boolean | Promise<boolean>;

// ─── Menu context ───────────────────────────────────────────────

/**
 * Second argument passed to every `@MenuAction` handler.
 *
 * `T` is the session data type for this menu instance.
 *
 * ```ts
 * @MenuAction('main', 'products', { ... })
 * async onProducts(ctx: Context, mctx: MenuContext<{ cart: string[] }>) {
 *   mctx.session.data.cart.push('item-1');
 * }
 * ```
 */
export interface MenuContext<T = any> {
  user: {
    id?: number;
    username?: string;
    isAdmin: boolean;
    paid: boolean;
    notificationsEnabled: boolean;
  };
  /** Mutable per‑menu‑instance session (created at `menuService.start()`). */
  session: MenuSession<T>;
  /**
   * When handling a dynamic button tap, contains the `data` payload
   * of the pressed button. `undefined` for static menu actions.
   */
  buttonData?: any;
}

// ─── Dynamic buttons ────────────────────────────────────────────

/**
 * A single dynamic button rendered alongside static children.
 * `data` is stored server‑side and delivered via `mctx.buttonData`
 * when the user taps this button.
 */
export interface DynamicButton<T = any> {
  /** Button text shown to the user. */
  label: string;
  /** Arbitrary payload attached to this button (stored server‑side). */
  data: T;
  /** Sort order among dynamic buttons (default `0`). */
  order?: number;
  /** When `true` the button is greyed-out; tap shows `disabledText`. */
  disabled?: boolean;
  /** Text shown when tapping a disabled button (default `'Unavailable'`). */
  disabledText?: string;
  /** When `true` the button is omitted from the keyboard. */
  hidden?: boolean;
}

export type MenuActionCtx<
  TSession = any,
  TButtonData = any,
> = MenuContext<TSession> & {
  buttonData?: TButtonData;
};

export type MenuActionContext<
  TSession = any,
  TButtonData = any,
> = MenuActionCtx<TSession, TButtonData>;

export type MenuDynamicButtonsProvider<TSession = any, TButtonData = any> = (
  ctx: any,
  mctx: MenuContext<TSession>,
) => Promise<DynamicButton<TButtonData>[]>;

// ─── Decorator options & metadata ───────────────────────────────

export type MenuActionOptions<TSession = any, TButtonData = any> = {
  label?: string;
  description?: string;
  order?: number;
  parentFunction?: Function;
  parentActionId?: string;
  guard?: MenuPredicate | MenuPredicate[];
  disabled?: MenuPredicate | MenuPredicate[];
  disabledText?: string;
  hidden?: boolean;
  columns?: number;
  back?: boolean;
  dynamicButtonsProvider?: string;

  /**
   * Reference to a method on the same class that provides dynamic buttons.
   *
   * The provider method receives `(ctx, mctx)` and returns
   * `Promise<DynamicButton<T>[]>`. The buttons are rendered below
   * static children. When a user taps one, **this** `@MenuAction`
   * handler is called with `mctx.buttonData` set to the pressed
   * button's `data`.
   *
   * ```ts
   * @MenuAction('main', 'products', {
   *   label: '🛒 Products',
   *   dynamicButtons: MyHandlers.prototype.getProducts,
   * })
   * async onProductPicked(ctx, mctx: MenuContext<MyData>) {
   *   const product = mctx.buttonData; // typed at runtime
   *   return 'handled';
   * }
   *
   * async getProducts(ctx, mctx) {
   *   return [{ label: 'Item', data: { id: 1 } }];
   * }
   * ```
   */
  dynamicButtons?: MenuDynamicButtonsProvider<TSession, TButtonData>;
};

export type MenuActionMetadata<TSession = any, TButtonData = any> = {
  flowId: string;
  actionId: string;
  key: string;
  options: MenuActionOptions<TSession, TButtonData>;
};

function normalizeLegacyKey<TSession = any, TButtonData = any>(
  key: string,
): MenuActionMetadata<TSession, TButtonData> {
  const [flowId, ...rest] = key.split(".");
  return {
    flowId: flowId || "default",
    actionId: rest.length ? rest.join(".") : key,
    key,
    options: {},
  };
}

export function MenuAction<TSession = any, TButtonData = any>(
  flowIdOrKey: string,
  actionId?: string,
  options: MenuActionOptions<TSession, TButtonData> = {},
): MethodDecorator {
  return (target, propertyKey, descriptor: TypedPropertyDescriptor<any>) => {
    if (descriptor?.value) {
      const metadata = actionId
        ? {
            flowId: flowIdOrKey,
            actionId,
            key: `${flowIdOrKey}.${actionId}`,
            options,
          }
        : normalizeLegacyKey<TSession, TButtonData>(flowIdOrKey);

      SetMetadata(MENU_ACTION_METADATA, metadata)(descriptor.value);
    }
  };
}
