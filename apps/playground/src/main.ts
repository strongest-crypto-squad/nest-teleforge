import { NestFactory } from "@nestjs/core";
import { PlaygroundModule } from "./playground.module";

async function bootstrap() {
  const app = await NestFactory.create(PlaygroundModule);
  await app.listen(3000);
}
bootstrap();
