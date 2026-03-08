import { SetMetadata } from '@nestjs/common';
export const MENU_ACTION_METADATA = 'MENU_ACTION';
export type MenuActionResult = 'handled' | 'rerender' | 'rerender-parent';
export type MenuPredicate = (ctx: any) => boolean | Promise<boolean>;

export type MenuActionOptions = {
  label?: string;
  description?: string;
  order?: number;
  parentFunction?: Function;
  guard?: MenuPredicate | MenuPredicate[];
  disabled?: MenuPredicate | MenuPredicate[];
  disabledText?: string;
  hidden?: boolean;
  columns?: number;
  back?: boolean;
};

export type MenuActionMetadata = {
  flowId: string;
  actionId: string;
  key: string;
  options: MenuActionOptions;
};

function normalizeLegacyKey(key: string): MenuActionMetadata {
  const [flowId, ...rest] = key.split('.');
  return {
    flowId: flowId || 'default',
    actionId: rest.length ? rest.join('.') : key,
    key,
    options: {},
  };
}

export function MenuAction(
  flowIdOrKey: string,
  actionId?: string,
  options: MenuActionOptions = {},
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
        : normalizeLegacyKey(flowIdOrKey);

      SetMetadata(MENU_ACTION_METADATA, metadata)(descriptor.value);
    }
  };
}
