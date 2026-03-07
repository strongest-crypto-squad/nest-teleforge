import 'reflect-metadata';
import { IsInt, IsString, Min } from 'class-validator';
import { Prompt } from './form.decorator';
import { tgForm, TgFormContext } from './tgForm';

class CheckoutDto {
  @Prompt('Enter product')
  @IsString()
  product: string = '';

  @Prompt('Enter quantity')
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
      'Enter product',
      'Enter quantity',
      'Error: quantity must not be less than 1',
      'Enter quantity',
    ]);

    expect(ctx.waitForMessage).toHaveBeenCalledTimes(3);
  });
});
