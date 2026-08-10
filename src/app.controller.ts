import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsString, IsNotEmpty, IsEmail } from 'class-validator';
import { AppService } from './app.service';

export class SampleDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('test-validation')
  testValidation(@Body() body: SampleDto) {
    return { success: true, data: body };
  }
}
