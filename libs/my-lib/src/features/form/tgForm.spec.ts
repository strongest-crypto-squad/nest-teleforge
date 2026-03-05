import 'reflect-metadata';
import { IsInt, IsString, Min } from 'class-validator';
import { Prompt } from 'libs/my-lib/src/features/form/form.decorator';
import { tgForm, TgFormContext } from './tgForm';

class CheckoutDto {
  @Prompt('Введите товар')
  @IsString()
  product: string = '';

  @Prompt('Введите количество')
  @IsInt()
  @Min(1)
  quantity: number = 0;
}

describe('tgForm flow', () => {
  it('asks fields in order and retries invalid value', async () => {
    const replies: string[] = [];
    const inputs = ['Laptop', '0', '2'];

    const ctx: TgFormContext = {
      reply: jest.fn(async (text: string) => {
        replies.push(text);
      }),
      waitForMessage: jest.fn(async () => {
        const next = inputs.shift();
        if (next === undefined) {
          throw new Error('No input prepared');
        }
        return next;
      }),
    };

    const result = await tgForm(CheckoutDto, ctx);

    expect(result.product).toBe('Laptop');
    expect(result.quantity).toBe(2);

    expect(replies).toEqual([
      'Введите товар',
      'Введите количество',
      'Ошибка: quantity must not be less than 1',
      'Введите количество',
    ]);

    expect(ctx.waitForMessage).toHaveBeenCalledTimes(3);
  });
});
