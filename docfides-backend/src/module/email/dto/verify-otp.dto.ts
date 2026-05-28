import { IsEmail, IsNotEmpty, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class VerifyOtpDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  @Length(6, 6)
  otp: string;
}
