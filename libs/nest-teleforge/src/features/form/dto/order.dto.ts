import { IsEnum, IsInt, Min, IsDate, IsString } from "class-validator";
import { Prompt } from "../form.decorator";
export enum Size {
  Small = "small",
  Medium = "medium",
  Large = "large",
}
export class OrderDto {
  @Prompt("What product would you like to order?") @IsString() product: string = "";
  @Prompt("How many units? (number ≥ 1)") @IsInt() @Min(1) quantity: number = 1;
  @Prompt("Choose size (small/medium/large)") @IsEnum(Size) size: Size =
    Size.Medium;
  @Prompt("When should we deliver? (YYYY-MM-DD)") @IsDate() deliveryDate: Date =
    new Date();
}
