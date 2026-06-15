import {
  Body,
  Controller,
  ForbiddenException,
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
import { ChangePasswordDto } from './dto/change-password.dto';
import { RequestAcademicProfileChangeDto } from './dto/academic-profile-change.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: Request & { user: { userId: string } }) {
    return this.authService.getProfile(req.user.userId);
  }

  @Get('register-options')
  async getRegisterOptions() {
    return this.authService.getRegisterOptions();
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(req.user.userId, dto);
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.userId, dto);
  }

  @Post('academic-profile/change-request')
  @UseGuards(JwtAuthGuard)
  async requestAcademicProfileChange(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: RequestAcademicProfileChangeDto,
  ) {
    return this.authService.requestAcademicProfileChange(req.user.userId, dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto.email, dto.password);

    return this.authService.login(user);
  }

  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  requestOtp(@Body() _dto: RequestOtpDto) {
    throw new ForbiddenException(
      'Pendaftaran mandiri dinonaktifkan. Silakan hubungi admin prodi atau superadmin untuk pembuatan akun.',
    );
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() _dto: VerifyOtpDto) {
    throw new ForbiddenException(
      'Pendaftaran mandiri dinonaktifkan. Silakan hubungi admin prodi atau superadmin untuk pembuatan akun.',
    );
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() _dto: RegisterDto) {
    throw new ForbiddenException(
      'Pendaftaran mandiri dinonaktifkan. Silakan hubungi admin prodi atau superadmin untuk pembuatan akun.',
    );
  }
}
