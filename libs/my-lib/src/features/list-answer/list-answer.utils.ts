import { Predicate } from './dto/list-answer.types';
import { Context } from 'telegraf';

export function normalizePredicates<T>(
  predicate?: Predicate<T> | Predicate<T>[],
): Predicate<T>[] {
  if (!predicate) return [];
  return Array.isArray(predicate) ? predicate : [predicate];
}

export async function checkPredicate<T>(
  item: T,
  predicates: Predicate<T>[],
  ctx: Context,
): Promise<boolean> {
  for (const p of predicates) {
    if (!(await p(item, ctx))) return false;
  }
  return true;
}
