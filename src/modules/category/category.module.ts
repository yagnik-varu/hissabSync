import { Module } from '@nestjs/common';
import { CategoryService } from './services/category.service';
import { CategoryRepository } from './repositories/category.repository';

import { AuthModule } from '../auth/auth.module';
import { RoomModule } from '../room/room.module';
import { CategoryController } from './controllers/category.controller';

@Module({
  imports: [AuthModule, RoomModule],
  controllers: [CategoryController],
  providers: [CategoryService, CategoryRepository],
  exports: [CategoryService],
})
export class CategoryModule {}
