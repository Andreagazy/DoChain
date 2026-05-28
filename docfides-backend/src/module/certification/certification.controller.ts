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
import { JwtAuthGuard } from '../auth/guard/jwt.guard';
import { IdentityApprovedGuard } from '../identity/guard/identity-approved.guard';
import { CertificationService } from './certification.service';
import { SignDocumentDto } from './dto/sign-document.dto';
import { RequestSignersDto } from './dto/request-signers.dto';
import { DeclineDocumentDto } from './dto/decline-document.dto';
import { UpdateSignaturePreferenceDto } from './dto/update-signature-preference.dto';
import { FinalizeQrDto } from './dto/finalize-qr.dto';

type RequestWithUser = Request & {
  user: {
    userId: string;
  };
};

const signatureUploadRoot = resolve(
  process.cwd(),
  process.env.SIGNATURE_UPLOAD_DIR ?? 'uploads/signatures',
);

const documentUploadRoot = resolve(
  process.cwd(),
  process.env.DOCUMENT_UPLOAD_DIR ?? 'uploads/documents',
);

@Controller('certification')
@UseGuards(JwtAuthGuard, IdentityApprovedGuard)
export class CertificationController {
  constructor(private certificationService: CertificationService) {}

  @Post('documents/upload')
  @UseInterceptors(
    FileInterceptor('documentFile', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const request = req as RequestWithUser;
          const userDir = join(documentUploadRoot, request.user.userId);
          mkdirSync(userDir, { recursive: true });
          cb(null, userDir);
        },
        filename: (_req, file, cb) => {
          const extension = extname(file.originalname).toLowerCase() || '.pdf';
          const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`;
          cb(null, safeName);
        },
      }),
      fileFilter: (_req, file, cb) => {
        cb(null, file.mimetype === 'application/pdf');
      },
      limits: {
        fileSize: 20 * 1024 * 1024,
      },
    }),
  )
  async uploadDocument(
    @Req() req: RequestWithUser,
    @UploadedFile() documentFile: Express.Multer.File,
  ) {
    return this.certificationService.uploadDocument(
      req.user.userId,
      documentFile,
    );
  }

  @Get('documents/my')
  async listMyDocuments(@Req() req: RequestWithUser) {
    return this.certificationService.listMyDocuments(req.user.userId);
  }

  @Get('documents/assigned')
  async listAssignedDocuments(@Req() req: RequestWithUser) {
    return this.certificationService.listAssignedDocuments(req.user.userId);
  }

  @Get('documents/:documentId/file')
  async getDocumentFile(
    @Req() req: RequestWithUser,
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ) {
    const preview = await this.certificationService.getDocumentFileForPreview(
      req.user.userId,
      documentId,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${preview.fileName}"`,
    );
    res.send(preview.content);
  }

  @Get('documents/:documentId/file/original')
  async getOriginalDocumentFile(
    @Req() req: RequestWithUser,
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ) {
    const file = await this.certificationService.getOriginalDocumentFile(
      req.user.userId,
      documentId,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    res.send(file.content);
  }

  @Get('documents/:documentId/file/signed')
  async getSignedDocumentFile(
    @Req() req: RequestWithUser,
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ) {
    const file = await this.certificationService.getSignedDocumentFile(
      req.user.userId,
      documentId,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    res.send(file.content);
  }

  @Get('documents/:documentId/placeholders')
  async getSignerPlaceholders(
    @Req() req: RequestWithUser,
    @Param('documentId') documentId: string,
  ) {
    return this.certificationService.getSignerPlaceholders(
      req.user.userId,
      documentId,
    );
  }

  @Get('signers/candidates')
  async listSignerCandidates(@Req() req: RequestWithUser) {
    return this.certificationService.listSignerCandidates(req.user.userId);
  }

  @Get('signature/me')
  async getSignatureStatus(@Req() req: RequestWithUser) {
    return this.certificationService.getSignatureStatus(req.user.userId);
  }

  @Get('ipfs/status')
  async getIpfsStatus() {
    return this.certificationService.getIpfsStatus();
  }

  @Patch('signature/preference')
  async updateSignaturePreference(
    @Req() req: RequestWithUser,
    @Body() dto: UpdateSignaturePreferenceDto,
  ) {
    return this.certificationService.updateSignaturePreference(
      req.user.userId,
      dto,
    );
  }

  @Get('documents/:documentId/eligibility')
  async getEligibility(
    @Req() req: RequestWithUser,
    @Param('documentId') documentId: string,
  ) {
    return this.certificationService.getEligibility(
      req.user.userId,
      documentId,
    );
  }

  @Post('documents/:documentId/start')
  async startCertification(
    @Req() req: RequestWithUser,
    @Param('documentId') documentId: string,
  ) {
    return this.certificationService.startCertification(
      req.user.userId,
      documentId,
    );
  }

  @Post('signature/upload')
  @UseInterceptors(
    FileInterceptor('signatureFile', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const request = req as RequestWithUser;
          const userDir = join(signatureUploadRoot, request.user.userId);
          mkdirSync(userDir, { recursive: true });
          cb(null, userDir);
        },
        filename: (req, file, cb) => {
          const request = req as RequestWithUser;
          const extension = extname(file.originalname).toLowerCase() || '.png';
          cb(null, `${request.user.userId}-signature${extension}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const allowedMime = ['image/jpeg', 'image/jpg', 'image/png'];
        cb(null, allowedMime.includes(file.mimetype));
      },
      limits: {
        fileSize: 2 * 1024 * 1024,
      },
    }),
  )
  uploadSignatureImage(
    @Req() req: RequestWithUser,
    @UploadedFile() signatureFile: Express.Multer.File,
  ) {
    return this.certificationService.uploadSignatureImage(
      req.user.userId,
      signatureFile,
    );
  }

  @Post('documents/:documentId/sign')
  async signDocument(
    @Req() req: RequestWithUser,
    @Param('documentId') documentId: string,
    @Body() dto: SignDocumentDto,
  ) {
    return this.certificationService.signDocument(
      req.user.userId,
      documentId,
      dto,
    );
  }

  @Post('documents/:documentId/decline')
  async declineDocument(
    @Req() req: RequestWithUser,
    @Param('documentId') documentId: string,
    @Body() dto: DeclineDocumentDto,
  ) {
    return this.certificationService.declineDocument(
      req.user.userId,
      documentId,
      dto,
    );
  }

  @Post('documents/:documentId/finalize-qr')
  async finalizeQr(
    @Req() req: RequestWithUser,
    @Param('documentId') documentId: string,
    @Body() dto: FinalizeQrDto,
  ) {
    return this.certificationService.finalizeQr(
      req.user.userId,
      documentId,
      dto,
    );
  }

  @Post('documents/:documentId/request-signers')
  async requestSigners(
    @Req() req: RequestWithUser,
    @Param('documentId') documentId: string,
    @Body() dto: RequestSignersDto,
  ) {
    return this.certificationService.requestSigners(
      req.user.userId,
      documentId,
      dto,
    );
  }
}
