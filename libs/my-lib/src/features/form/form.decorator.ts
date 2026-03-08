import 'reflect-metadata';
const PROMPT_METADATA_KEY = Symbol('prompt');
export function Prompt(text: string) {
  return Reflect.metadata(PROMPT_METADATA_KEY, text);
}
export function getPrompt(
  target: any,
  propertyKey: string,
): string | undefined {
  return Reflect.getMetadata(PROMPT_METADATA_KEY, target, propertyKey);
}
