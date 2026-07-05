import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class ReviewDocumentRevokeRequestDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MinLength(5)
  reviewNote?: string;
}
