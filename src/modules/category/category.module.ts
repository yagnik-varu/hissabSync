import { Module } from '@nestjs/common';
import { CategoryService } from './services/category.service';
import { CategoryRepository } from './repositories/category.repository';

@Module({
  providers: [CategoryService, CategoryRepository],
  exports: [CategoryService],
})
export class CategoryModule {}
