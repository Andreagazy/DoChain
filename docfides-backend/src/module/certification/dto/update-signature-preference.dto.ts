import { IsEnum } from 'class-validator';
import { SignatureMode } from './sign-document.dto';

export class UpdateSignaturePreferenceDto {
  @IsEnum(SignatureMode)
  mode!: SignatureMode;
}
