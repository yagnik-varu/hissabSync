import { Injectable } from '@nestjs/common';
import { PrismaClient } from '../../../../generated/prisma/client/client';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}
}
