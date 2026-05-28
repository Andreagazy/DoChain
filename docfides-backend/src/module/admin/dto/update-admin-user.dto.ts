import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum AdminUserRole {
  SUPERADMIN = 'SUPERADMIN',
  JURUSAN = 'JURUSAN',
  PRODI = 'PRODI',
  ADMIN_PRODI = 'ADMIN_PRODI',
  PEGAWAI = 'PEGAWAI',
  MAHASISWA = 'MAHASISWA',
}

export enum AdminUserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DISABLED = 'DISABLED',
}

export enum AdminEmploymentType {
  DOSEN = 'DOSEN',
  TENAGA_KEPENDIDIKAN = 'TENAGA_KEPENDIDIKAN',
  ADMINISTRASI = 'ADMINISTRASI',
}

export enum AdminStructuralPosition {
  KAJUR = 'KAJUR',
  KAPRODI = 'KAPRODI',
  ADMIN_PRODI = 'ADMIN_PRODI',
}

export class AdminStudentProfileDto {
  @IsString()
  @MaxLength(40)
  nim!: string;

  @IsString()
  prodiId!: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  angkatan?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  kelas?: string;
}

export class AdminEmployeeProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  nip?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  nidn?: string | null;

  @IsEnum(AdminEmploymentType)
  employeeType!: AdminEmploymentType;

  @IsString()
  homeUnitId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  positionTitle?: string | null;
}

export class AdminStructuralAssignmentDto {
  @IsString()
  academicUnitId!: string;

  @IsEnum(AdminStructuralPosition)
  position!: AdminStructuralPosition;
}

export class UpdateAdminUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  certificateFullName?: string | null;

  @IsOptional()
  @IsEnum(AdminUserRole)
  role?: AdminUserRole;

  @IsOptional()
  @IsEnum(AdminUserStatus)
  status?: AdminUserStatus;

  @IsOptional()
  @ValidateNested()
  @Type(() => AdminStudentProfileDto)
  studentProfile?: AdminStudentProfileDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => AdminEmployeeProfileDto)
  employeeProfile?: AdminEmployeeProfileDto | null;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AdminStructuralAssignmentDto)
  structuralAssignments?: AdminStructuralAssignmentDto[];
}

export class CreateAdminUserDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(120)
  displayName!: string;

  @IsEnum(AdminUserRole)
  role!: AdminUserRole;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  password?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AdminStudentProfileDto)
  studentProfile?: AdminStudentProfileDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AdminEmployeeProfileDto)
  employeeProfile?: AdminEmployeeProfileDto;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AdminStructuralAssignmentDto)
  structuralAssignments?: AdminStructuralAssignmentDto[];
}

export class ResetAdminUserPasswordDto {
  @IsString()
  @MaxLength(120)
  password!: string;
}
