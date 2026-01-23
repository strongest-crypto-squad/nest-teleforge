import { SetMetadata } from '@nestjs/common';
export const MENU_ACTION_METADATA = 'MENU_ACTION';
export type MenuActionResult = 'handled' | 'rerender' | 'rerender-parent';
export function MenuAction(key: string): MethodDecorator {
  return (target, propertyKey, descriptor: TypedPropertyDescriptor<any>) => {
    if (descriptor?.value) {
      SetMetadata(MENU_ACTION_METADATA, key)(descriptor.value);
    }
  };
}
