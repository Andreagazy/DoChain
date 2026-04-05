import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(20)
  @Matches(/(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).*/, {
    message: 'Password harus mengandung huruf besar, huruf kecil, dan angka',
  })
  password: string;

  @IsNotEmpty()
  confirmPassword: string;
}
