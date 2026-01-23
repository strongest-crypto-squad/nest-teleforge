import { Controller, Get } from '@nestjs/common';
import { PlaygroundService } from './playground.service';

@Controller()
export class PlaygroundController {
  constructor(private readonly playgroundService: PlaygroundService) {}

  @Get()
  getHello(): string {
    return this.playgroundService.getHello();
  }
}
