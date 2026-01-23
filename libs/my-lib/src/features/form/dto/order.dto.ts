import { IsEnum, IsInt, Min, IsDate, IsString } from "class-validator";
import { Prompt } from "libs/my-lib/src/features/form/form.decorator";
export enum Size {
  Small = "small",
  Medium = "medium",
  Large = "large",
}
export class OrderDto {
  @Prompt("Какой товар хотите заказать?") @IsString() product: string = "";
  @Prompt("Сколько штук? (число ≥ 1)") @IsInt() @Min(1) quantity: number = 1;
  @Prompt("Выберите размер (small/medium/large)") @IsEnum(Size) size: Size =
    Size.Medium;
  @Prompt("Когда доставить? (YYYY-MM-DD)") @IsDate() deliveryDate: Date =
    new Date();
}
