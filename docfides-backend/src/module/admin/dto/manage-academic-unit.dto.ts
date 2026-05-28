import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum AdminAcademicUnitType {
  JURUSAN = 'JURUSAN',
  PRODI = 'PRODI',
}

export class CreateAcademicUnitDto {
  @IsString()
  @MaxLength(30)
  code!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsEnum(AdminAcademicUnitType)
  type!: AdminAcademicUnitType;

  @IsOptional()
  @IsString()
  parentId?: string | null;
}

export class UpdateAcademicUnitDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
