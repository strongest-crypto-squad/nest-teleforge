import { Context } from 'telegraf';

export type ListContext = Context;

export type Predicate<T> = (
  item: T,
  ctx: ListContext,
) => boolean | Promise<boolean>;

export type ListAnswerResult<T> =
  | { type: 'selected'; item: T }
  | { type: 'cancel' }
  | { type: 'timeout' };

export type ListAnswerOptions<T> = {
  getLabel: (item: T) => string;

  getKey?: (item: T) => string;

  predicate?: Predicate<T> | Predicate<T>[];
  disabledStrategy?: 'hide' | 'disable';

  disabledLabelSuffix?: string;

  message?: string;

  cancel?: {
    label?: string;
    value?: string;
  };

  timeoutMs?: number;

  onBeforeShow?: (list: T[], ctx: ListContext) => void | Promise<void>;
  onSelect?: (item: T, ctx: ListContext) => void | Promise<void>;
};

export type PageItem<T> = {
  key: string;
  item: T;
  label: string;
  enabled: boolean;
};
