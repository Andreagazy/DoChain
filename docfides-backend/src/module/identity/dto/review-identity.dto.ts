import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewIdentityDto {
    @IsIn(['APPROVED', 'REJECTED'])
    status: 'APPROVED' | 'REJECTED';

    @IsOptional()
    @IsString()
    @MaxLength(500)
    rejectionReason?: string;
}
