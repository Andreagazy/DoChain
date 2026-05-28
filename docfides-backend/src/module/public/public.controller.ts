import {
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PublicService } from './public.service';

@Controller('public')
export class PublicController {
  constructor(private publicService: PublicService) {}

  /**
   * Public endpoint — no authentication required.
   * Called when a QR code on a printed document is scanned.
   */
  @Get('documents/:documentId/verify')
  async verifyDocument(@Param('documentId') documentId: string) {
    return this.publicService.verifyDocument(documentId);
  }

  /**
   * Public endpoint — no authentication required.
   * Accept a PDF file upload (memory-only, NOT saved to disk) and
   * return detailed signature + certificate chain inspection results.
   * Designed for the drag-and-drop document verification UI.
   */
  @Post('documents/inspect')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50 MB max
      },
      fileFilter: (
        _req: Express.Request,
        file: Express.Multer.File,
        cb: (error: Error | null, acceptFile: boolean) => void,
      ) => {
        if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Hanya file PDF yang diperbolehkan'), false);
        }
      },
    }),
  )
  async inspectDocument(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer) {
      throw new BadRequestException('File PDF wajib diunggah');
    }
    return this.publicService.inspectDocument(file.buffer);
  }
}
