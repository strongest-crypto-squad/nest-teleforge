import { Module } from '@nestjs/common';
import { MyLibService } from './my-lib.service';

@Module({
  providers: [MyLibService],
  exports: [MyLibService],
})
export class MyLibModule {}
