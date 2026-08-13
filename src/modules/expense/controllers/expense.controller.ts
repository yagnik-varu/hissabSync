import { Controller, Get, Post, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ExpenseService } from '../services/expense.service';
import { SubmitExpenseDto } from '../dto/submit-expense.dto';
import { ListExpensesDto } from '../dto/list-expenses.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RoomMemberGuard } from '../../../common/guards/room-member.guard';
import { CurrentRoom } from '../../../common/decorators/current-room.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RoomContext } from '../../../common/types/room-context.type';
import type { UserPayload } from '../../../common/types/user-payload.type';

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RoomMemberGuard)
@Controller('rooms/:roomId/expenses')
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a new expense' })
  @ApiResponse({ status: 201, description: 'Expense submitted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async submitExpense(
    @CurrentRoom() room: RoomContext,
    @CurrentUser() user: UserPayload,
    @Body() dto: SubmitExpenseDto,
  ) {
    const expense = await this.expenseService.submitExpense(room.id, user.sub, dto);
    return {
      success: true,
      message: 'Expense submitted successfully',
      data: expense,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List all expenses in a room' })
  @ApiResponse({ status: 200, description: 'Expenses retrieved successfully' })
  async listExpenses(
    @CurrentRoom() room: RoomContext,
    @Query() filters: ListExpensesDto,
  ) {
    const { data, meta } = await this.expenseService.listExpenses(room.id, filters);
    return {
      success: true,
      message: 'Data retrieved successfully',
      data,
      meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific expense' })
  @ApiResponse({ status: 200, description: 'Expense retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Expense not found' })
  async getExpenseDetails(
    @CurrentRoom() room: RoomContext,
    @Param('id', ParseUUIDPipe) expenseId: string,
  ) {
    const expense = await this.expenseService.getExpenseDetails(room.id, expenseId);
    return {
      success: true,
      message: 'Expense retrieved successfully',
      data: expense,
    };
  }
}
