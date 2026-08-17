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
    if (content.includes('import { UseGuards')) {
       // already imported UseGuards
    } else {
       // Need to import UseGuards? It's already there in all these files from '@nestjs/common'
    }
    content = content.replace(
      'import { RoomMemberGuard } from \'../../../common/guards/room-member.guard\';',
      'import { RoomMemberGuard } from \'../../../common/guards/room-member.guard\';\nimport { RoomNotArchivedGuard } from \'../../../common/guards/room-not-archived.guard\';'
    );
  }

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
        // Find existing @UseGuards ABOVE this method
        let found = false;
        // Search upwards until we hit the previous method or class declaration
        for (let j = i - 1; j >= 0; j--) {
          if (lines[j].includes('async ') || lines[j].includes('class ')) break;
          if (lines[j].includes('@UseGuards(')) {
            if (!lines[j].includes('RoomNotArchivedGuard')) {
              lines[j] = lines[j].replace(')', ', RoomNotArchivedGuard)');
            }
            found = true;
            break;
          }
        }
        
        // If not found, inject @UseGuards(RoomNotArchivedGuard) right above the first decorator of this method
        if (!found) {
            // Find the start of decorators for this method
            let insertPos = i;
            while (insertPos > 0 && lines[insertPos - 1].trim().startsWith('@')) {
               insertPos--;
            }
            const indent = lines[i].match(/^\s*/)[0];
            lines.splice(insertPos, 0, indent + '@UseGuards(RoomNotArchivedGuard)');
            i++; // Adjust for the inserted line
        }
      }
    }
    content = lines.join('\n');
  }

  fs.writeFileSync(filePath, content);
}
