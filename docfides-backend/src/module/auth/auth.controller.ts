import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Req,
  Patch,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RequestOtpDto } from '../email/dto/request-otp.dto';
import { VerifyOtpDto } from '../email/dto/verify-otp.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guard/jwt.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: Request & { user: { userId: string } }) {
    return this.authService.getProfile(req.user.userId);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(req.user.userId, dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto.email, dto.password);

    return this.authService.login(user);
  }

  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  async requestOtp(@Body() dto: RequestOtpDto) {
    await this.authService.requestOtp(dto.email);
    return { message: 'Kode OTP telah dikirim ke email Anda' };
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.email, dto.otp);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(
      dto.email,
      dto.password,
      dto.confirmPassword,
    );
  }
}
