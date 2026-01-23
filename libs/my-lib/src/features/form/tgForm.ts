import "reflect-metadata";
import { validateSync } from "class-validator";
import { getPrompt } from "libs/my-lib/src/features/form/form.decorator";
export interface TgFormContext {
  reply: (text: string) => Promise<void>;
  waitForMessage: () => Promise<string>;
}
function coerceType(value: string, type: Function): any {
  const v = value.trim();
  switch (type) {
    case Number:
      return Number(v);
    case Boolean:
      return ["true", "1", "yes", "да", "y", "+"].includes(v.toLowerCase());
    case Date:
      return new Date(v);
    default:
      return value;
  }
}
export async function tgForm<T extends object>(
  dtoClass: new () => T,
  ctx: TgFormContext,
): Promise<T> {
  const instance = new dtoClass();
  const keys = Object.keys(instance) as (keyof T)[];
  for (const key of keys) {
    const fieldType = Reflect.getMetadata(
      "design:type",
      instance,
      key as string,
    );
    while (true) {
      const prompt = getPrompt(instance, key as string) ?? `${String(key)}:`;
      await ctx.reply(prompt);
      const input = await ctx.waitForMessage();
      const casted = coerceType(input, fieldType);
      (instance as any)[key] = casted;
      const errors = validateSync(instance as any);
      const error = errors.find((e) => e.property === key);
      if (!error) break;
      const msg = Object.values(error.constraints!)[0];
      await ctx.reply(`Ошибка: ${msg}`);
    }
  }
  return instance;
}
