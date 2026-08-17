const fs = require('fs');
const path = require('path');

const controllers = [
  'src/modules/treasury/controllers/treasury.controller.ts',
  'src/modules/treasury/controllers/contribution.controller.ts',
  'src/modules/expense/controllers/expense.controller.ts',
  'src/modules/reimbursement/controllers/reimbursement.controller.ts',
  'src/modules/category/controllers/category.controller.ts',
  'src/modules/room/controllers/member.controller.ts',
  'src/modules/room/controllers/room.controller.ts'
];

for (const file of controllers) {
  const filePath = path.resolve(file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes('RoomNotArchivedGuard')) {
    // Add import
    content = content.replace(
      'import { RoomMemberGuard } from \'../../../common/guards/room-member.guard\';',
      'import { RoomMemberGuard } from \'../../../common/guards/room-member.guard\';\nimport { RoomNotArchivedGuard } from \'../../../common/guards/room-not-archived.guard\';'
    );
  }

  // Define which methods get the guard using String matching instead of regex to avoid compilation issues
  const methods = {
    'treasury.controller.ts': ['async createAdjustment('],
    'contribution.controller.ts': ['async submitContribution(', 'async cancelContribution(', 'async approveContribution(', 'async rejectContribution('],
    'expense.controller.ts': ['async submitExpense(', 'async cancelExpense(', 'async approveExpense(', 'async rejectExpense('],
    'reimbursement.controller.ts': ['async payReimbursement('],
    'category.controller.ts': ['async createCategory(', 'async deleteCategory('],
    'member.controller.ts': ['async requestJoin(', 'async approveJoinRequest(', 'async rejectJoinRequest(', 'async changeMemberRole(', 'async removeMember(', 'async requestLeave(', 'async approveLeaveRequest(', 'async rejectLeaveRequest('],
    'room.controller.ts': ['async updateRoom(']
  };

  const filename = path.basename(file);
  const targetMethods = methods[filename];
  if (targetMethods) {
    let lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (targetMethods.some(m => lines[i].includes(m))) {
        // Backtrack to find @UseGuards
        let found = false;
        for (let j = i - 1; j >= 0 && i - j < 10; j--) {
          if (lines[j].includes('@UseGuards(')) {
            if (!lines[j].includes('RoomNotArchivedGuard')) {
              lines[j] = lines[j].replace(')', ', RoomNotArchivedGuard)');
            }
            found = true;
            break;
          }
        }
        
        // If @UseGuards wasn't found (e.g. requestJoin in member.controller.ts), we inject it right above the method
        if (!found) {
            // Not doing it automatically for safety; mostly they should all have @UseGuards
            console.warn('Did not find @UseGuards for method in ' + filename + ' at line ' + i);
        }
      }
    }
    content = lines.join('\n');
  }

  fs.writeFileSync(filePath, content);
}
