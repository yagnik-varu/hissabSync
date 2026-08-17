import { Controller, Get, Post, Delete, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CategoryService } from '../services/category.service';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RoomMemberGuard } from '../../../common/guards/room-member.guard';
import { RoomNotArchivedGuard } from '../../../common/guards/room-not-archived.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentRoom } from '../../../common/decorators/current-room.decorator';

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RoomMemberGuard)
@Controller('rooms/:roomId/categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiOperation({ summary: 'List all categories in a room' })
  @ApiResponse({ status: 200, description: 'List of categories' })
  async getCategories(
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ) {
    const categories = await this.categoryService.getCategories(roomId);
    return {
      success: true,
      message: 'Data retrieved successfully',
      data: categories,
    };
  }

  @Post()
  @UseGuards(RolesGuard, RoomNotArchivedGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Create a new expense category' })
  @ApiResponse({ status: 201, description: 'Category created' })
  @ApiResponse({ status: 409, description: 'Category with this name already exists' })
  async createCategory(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    const category = await this.categoryService.createCategory(roomId, dto.name);
    return {
      success: true,
      message: 'Category created successfully',
      data: category,
    };
  }

  @Delete(':categoryId')
  @UseGuards(RolesGuard, RoomNotArchivedGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a category' })
  @ApiResponse({ status: 200, description: 'Category deleted' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 409, description: 'Category is in use by expenses' })
  async deleteCategory(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    await this.categoryService.deleteCategory(roomId, categoryId);
    return {
      success: true,
      message: 'Category deleted successfully',
      data: {},
    };
  }
}
