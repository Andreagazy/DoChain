import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class RequestAcademicProfileChangeDto {
  @IsString()
  @MaxLength(40)
  nim!: string;

  @IsString()
  prodiId!: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  angkatan?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  kelas?: string | null;
}
