import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guard/jwt.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorator/roles.decorator';
import { AdminService } from './admin.service';
import { CreateAdminUserDto, ResetAdminUserPasswordDto, UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { CreateAcademicUnitDto, UpdateAcademicUnitDto } from './dto/manage-academic-unit.dto';
import { RevokeDocumentDto } from './dto/revoke-document.dto';
import { ReviewDocumentRevokeRequestDto } from './dto/review-document-revoke-request.dto';
import { ReviewIdentityDto } from '../identity/dto/review-identity.dto';

type RequestWithUser = Request & {
  user: {
    userId: string;
  };
};

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN', 'ADMIN_PRODI')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('users')
  listUsers(@Req() req: RequestWithUser) {
    return this.adminService.listUsers(req.user.userId);
  }

  @Get('overview')
  overview(@Req() req: RequestWithUser) {
    return this.adminService.getOverview(req.user.userId);
  }

  @Post('users')
  @Roles('SUPERADMIN')
  createUser(@Body() dto: CreateAdminUserDto) {
    return this.adminService.createUser(dto);
  }

  @Get('users/:userId')
  getUser(@Req() req: RequestWithUser, @Param('userId') userId: string) {
    return this.adminService.getUser(userId, req.user.userId);
  }

  @Patch('users/:userId')
  updateUser(
    @Req() req: RequestWithUser,
    @Param('userId') userId: string,
    @Body() dto: UpdateAdminUserDto,
  ) {
    return this.adminService.updateUser(userId, dto, req.user.userId);
  }

  @Delete('users/:userId')
  @Roles('SUPERADMIN')
  deleteUser(@Param('userId') userId: string) {
    return this.adminService.deleteUser(userId);
  }

  @Patch('users/:userId/password')
  @Roles('SUPERADMIN')
  resetUserPassword(
    @Param('userId') userId: string,
    @Body() dto: ResetAdminUserPasswordDto,
  ) {
    return this.adminService.resetUserPassword(userId, dto.password);
  }

  @Get('identities')
  listIdentities(
    @Req() req: RequestWithUser,
    @Query('status') status?: string,
  ) {
    return this.adminService.listIdentities(req.user.userId, status);
  }

  @Patch('identities/:userId/review')
  reviewIdentity(
    @Req() req: RequestWithUser,
    @Param('userId') userId: string,
    @Body() dto: ReviewIdentityDto,
  ) {
    return this.adminService.reviewIdentity(req.user.userId, userId, dto);
  }

  @Get('academic-profile-change-requests')
  listAcademicProfileChangeRequests(@Req() req: RequestWithUser) {
    return this.adminService.listAcademicProfileChangeRequests(req.user.userId);
  }

  @Patch('academic-profile-change-requests/:requestId/review')
  reviewAcademicProfileChangeRequest(
    @Req() req: RequestWithUser,
    @Param('requestId') requestId: string,
    @Body() dto: ReviewIdentityDto,
  ) {
    return this.adminService.reviewAcademicProfileChangeRequest(
      req.user.userId,
      requestId,
      dto,
    );
  }

  @Get('academic-units')
  listAcademicUnits(@Req() req: RequestWithUser) {
    return this.adminService.listAcademicUnits(req.user.userId);
  }

  @Get('academic-units/:unitId')
  @Roles('SUPERADMIN')
  getAcademicUnit(@Param('unitId') unitId: string) {
    return this.adminService.getAcademicUnit(unitId);
  }

  @Post('academic-units')
  @Roles('SUPERADMIN')
  createAcademicUnit(@Body() dto: CreateAcademicUnitDto) {
    return this.adminService.createAcademicUnit(dto);
  }

  @Patch('academic-units/:unitId')
  @Roles('SUPERADMIN')
  updateAcademicUnit(
    @Param('unitId') unitId: string,
    @Body() dto: UpdateAcademicUnitDto,
  ) {
    return this.adminService.updateAcademicUnit(unitId, dto);
  }

  @Delete('academic-units/:unitId')
  @Roles('SUPERADMIN')
  deleteAcademicUnit(@Param('unitId') unitId: string) {
    return this.adminService.deleteAcademicUnit(unitId);
  }

  @Get('documents')
  listDocuments(@Req() req: RequestWithUser) {
    return this.adminService.listDocuments(req.user.userId);
  }

  @Get('documents/:documentId/file')
  async getDocumentFile(
    @Req() req: RequestWithUser,
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ) {
    const file = await this.adminService.getDocumentFile(
      req.user.userId,
      documentId,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${file.fileName}"`,
    );
    res.send(file.content);
  }

  @Delete('documents/:documentId')
  @Roles('SUPERADMIN')
  revokeDocument(
    @Req() req: RequestWithUser,
    @Param('documentId') documentId: string,
    @Body() dto: RevokeDocumentDto,
  ) {
    return this.adminService.revokeDocument(req.user.userId, documentId, dto);
  }

  @Get('document-revoke-requests')
  @Roles('SUPERADMIN')
  listDocumentRevokeRequests() {
    return this.adminService.listDocumentRevokeRequests();
  }

  @Get('document-revoke-requests/:requestId/evidences/:evidenceId')
  @Roles('SUPERADMIN')
  async getDocumentRevokeEvidence(
    @Param('requestId') requestId: string,
    @Param('evidenceId') evidenceId: string,
    @Res() res: Response,
  ) {
    const file = await this.adminService.getDocumentRevokeEvidence(
      requestId,
      evidenceId,
    );

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${file.fileName}"`,
    );
    res.send(file.content);
  }

  @Patch('document-revoke-requests/:requestId/review')
  @Roles('SUPERADMIN')
  reviewDocumentRevokeRequest(
    @Req() req: RequestWithUser,
    @Param('requestId') requestId: string,
    @Body() dto: ReviewDocumentRevokeRequestDto,
  ) {
    return this.adminService.reviewDocumentRevokeRequest(
      req.user.userId,
      requestId,
      dto,
    );
  }
}
