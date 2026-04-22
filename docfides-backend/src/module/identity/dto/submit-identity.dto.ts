import {
    IsDateString,
    IsNotEmpty,
    IsOptional,
    IsString,
    Length,
    MaxLength,
} from 'class-validator';

export class SubmitIdentityDto {
    @IsString()
    @IsNotEmpty()
    @Length(16, 16)
    nik: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(150)
    fullName: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    birthPlace?: string;

    @IsDateString()
    birthDate: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    address: string;
}
