import { Controller, Get, Post, Delete, Patch, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { ExpenseService } from '../services/expense.service';
import { SubmitExpenseDto } from '../dto/submit-expense.dto';
import { ListExpensesDto } from '../dto/list-expenses.dto';
import { RejectExpenseDto } from '../dto/reject-expense.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RoomMemberGuard } from '../../../common/guards/room-member.guard';
import { RoomNotArchivedGuard } from '../../../common/guards/room-not-archived.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
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
  @ApiBody({
    schema: {
      example: {
        categoryId: 'c-1234-uuid',
        amount: '1450.00',
        title: 'Weekly Vegetables & Dairy',
        description: 'Bought from Reliance Smart',
        receiptUrl: 'https://cdn.example.com/receipts/rec-01.jpg',
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Expense submitted successfully',
    schema: {
      example: {
        success: true,
        message: 'Expense submitted successfully',
        data: {
          id: 'exp-1234-uuid',
          amount: '1450.00',
          title: 'Weekly Vegetables & Dairy',
          status: 'PENDING',
        },
      },
    },
  })
  @UseGuards(RoomNotArchivedGuard)
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

  @UseGuards(RoomNotArchivedGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Cancel a pending expense (submitter only)' })
  @ApiResponse({ status: 200, description: 'Expense cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Only PENDING expenses can be cancelled' })
  @ApiResponse({ status: 403, description: 'You can only cancel your own expenses' })
  @ApiResponse({ status: 404, description: 'Expense not found' })
  async cancelExpense(
    @CurrentRoom() room: RoomContext,
    @CurrentUser() user: UserPayload,
    @Param('id', ParseUUIDPipe) expenseId: string,
  ) {
    await this.expenseService.cancelExpense(room.id, user.sub, expenseId);
    return {
      success: true,
      message: 'Expense cancelled successfully',
      data: {},
    };
  }

  @Patch(':id/approve')
  @UseGuards(RolesGuard, ThrottlerGuard, RoomNotArchivedGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Approve an expense' })
  @ApiResponse({
    status: 200,
    description: 'Expense approved successfully',
    schema: {
      example: {
        success: true,
        message: 'Expense approved successfully',
        data: {
          id: 'exp-1234-uuid',
          status: 'APPROVED',
          reimbursementInfo: {
            id: 'reimb-1234-uuid',
            status: 'PENDING_PAYMENT',
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Expense already processed' })
  @ApiResponse({ status: 404, description: 'Expense not found' })
  async approveExpense(
    @CurrentRoom() room: RoomContext,
    @CurrentUser() user: UserPayload,
    @Param('id', ParseUUIDPipe) expenseId: string,
  ) {
    const expense = await this.expenseService.approveExpense(room.id, expenseId, user.sub);
    return {
      success: true,
      message: 'Expense approved successfully',
      data: expense,
    };
  }

  @Patch(':id/reject')
  @UseGuards(RolesGuard, ThrottlerGuard, RoomNotArchivedGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Reject an expense' })
  @ApiResponse({ status: 200, description: 'Expense rejected successfully' })
  @ApiResponse({ status: 400, description: 'Expense already processed' })
  @ApiResponse({ status: 404, description: 'Expense not found' })
  async rejectExpense(
    @CurrentRoom() room: RoomContext,
    @CurrentUser() user: UserPayload,
    @Param('id', ParseUUIDPipe) expenseId: string,
    @Body() dto: RejectExpenseDto,
  ) {
    const expense = await this.expenseService.rejectExpense(room.id, expenseId, user.sub, dto.rejectionReason);
    return {
      success: true,
      message: 'Expense rejected successfully',
      data: expense,
    };
  }
}
