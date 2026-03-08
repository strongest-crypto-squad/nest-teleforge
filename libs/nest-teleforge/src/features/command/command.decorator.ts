import { SetMetadata } from "@nestjs/common";
import "reflect-metadata";

export const TG_COMMAND_METADATA = "TG_COMMAND";

export function TgCommand(command: string): MethodDecorator {
  return (target, key, descriptor: TypedPropertyDescriptor<any>) => {
    if (descriptor?.value) {
      SetMetadata(TG_COMMAND_METADATA, command)(descriptor.value);
    }
  };
}
