export type TgCtx = any;
export type Predicate = (ctx: TgCtx) => boolean | Promise<boolean>;
export interface MenuNode {
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
  c?: Record<string, MenuNode>;
}
