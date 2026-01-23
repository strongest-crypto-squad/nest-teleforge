import { Injectable } from '@nestjs/common';

@Injectable()
export class PlaygroundService {
  getHello(): string {
    return 'Hello World!';
  }
}
