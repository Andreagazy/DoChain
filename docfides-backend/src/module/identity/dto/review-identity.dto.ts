import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewIdentityDto {
  @IsIn(['APPROVED', 'REJECTED'], {
    message: 'Status review identitas hanya boleh APPROVED atau REJECTED',
  })
  status: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString({ message: 'Alasan penolakan wajib berupa teks' })
  @MaxLength(500, { message: 'Alasan penolakan maksimal 500 karakter' })
  rejectionReason?: string;
}
