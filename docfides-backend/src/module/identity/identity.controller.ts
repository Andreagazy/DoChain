import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { diskStorage } from 'multer';
import { extname, join, resolve } from 'path';
import { mkdirSync } from 'fs';
import { FileInterceptor } from '@nestjs/platform-express';
import { IdentityService } from './identity.service';
import { JwtAuthGuard } from '../auth/guard/jwt.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { SubmitIdentityDto } from './dto/submit-identity.dto';
import { ReviewIdentityDto } from './dto/review-identity.dto';

type RequestWithUser = Request & {
  user: {
    userId: string;
  };
};

const identityUploadRoot = resolve(
  process.cwd(),
  process.env.KTP_UPLOAD_DIR ?? 'uploads/identity',
);

@Controller('identity')
@UseGuards(JwtAuthGuard)
export class IdentityController {
  constructor(private identityService: IdentityService) {}

  @Post('submit')
  @UseInterceptors(
    FileInterceptor('ktpFile', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const request = req as RequestWithUser;
          const userDir = join(identityUploadRoot, request.user.userId);
          mkdirSync(userDir, { recursive: true });
          cb(null, userDir);
        },
        filename: (req, file, cb) => {
          const request = req as RequestWithUser;
          const extension = extname(file.originalname).toLowerCase() || '.jpg';
          cb(null, `${request.user.userId}-ktp${extension}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const allowedMime = ['image/jpeg', 'image/jpg', 'image/png'];
        cb(null, allowedMime.includes(file.mimetype));
      },
      limits: {
        fileSize: 3 * 1024 * 1024,
      },
    }),
  )
  async submitIdentity(
    @Req() req: RequestWithUser,
    @Body() dto: SubmitIdentityDto,
    @UploadedFile() ktpFile?: Express.Multer.File,
  ) {
    return this.identityService.submitIdentity(req.user.userId, dto, ktpFile);
  }

  @Get('me')
  async getMyIdentity(@Req() req: RequestWithUser) {
    return this.identityService.getMyIdentity(req.user.userId);
  }

  @Get('status')
  async getStatus(@Req() req: RequestWithUser) {
    return this.identityService.getIdentityStatus(req.user.userId);
  }

  @Get('certification-gate')
  async getCertificationGate(@Req() req: RequestWithUser) {
    return this.identityService.getCertificationGate(req.user.userId);
  }

  @Get('me/ktp')
  async getMyKtp(@Req() req: RequestWithUser, @Res() res: Response) {
    const path = await this.identityService.resolveKtpPath(req.user.userId);
    return res.sendFile(path);
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles('VERIFIER', 'ADMIN')
  async listPendingIdentities() {
    return this.identityService.listPendingIdentities();
  }

  @Patch(':userId/review')
  @UseGuards(RolesGuard)
  @Roles('VERIFIER', 'ADMIN')
  async reviewIdentity(
    @Req() req: RequestWithUser,
    @Param('userId') userId: string,
    @Body() dto: ReviewIdentityDto,
  ) {
    return this.identityService.reviewIdentity(req.user.userId, userId, dto);
  }

  @Get(':userId/ktp')
  @UseGuards(RolesGuard)
  @Roles('VERIFIER', 'ADMIN')
  async getKtpByUserId(@Param('userId') userId: string, @Res() res: Response) {
    const path = await this.identityService.resolveKtpPath(userId);
    return res.sendFile(path);
  }
}
