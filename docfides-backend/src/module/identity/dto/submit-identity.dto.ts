import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class SubmitIdentityDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @Length(16, 16)
  @Matches(/^\d{16}$/, { message: 'NIK harus berisi 16 digit angka' })
  nik: string;

  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsNotEmpty()
  @MaxLength(150)
  @Matches(/^[A-Za-zÀ-ÖØ-öø-ÿ\s.'-]+$/, {
    message: 'Nama lengkap hanya boleh berisi huruf, spasi, titik, apostrof, dan tanda hubung',
  })
  fullName: string;

  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/, {
    message: 'Tempat lahir hanya boleh berisi huruf dan spasi',
  })
  birthPlace: string;

  @IsDateString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  birthDate: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @MaxLength(500)
  address: string;
}
