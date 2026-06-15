import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export enum SignatureMode {
  VISIBLE = 'visible',
  INVISIBLE = 'invisible',
}

export class SignDocumentDto {
  @IsEnum(SignatureMode)
  mode: SignatureMode = SignatureMode.VISIBLE;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reason?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  visiblePage?: number;

  @IsOptional()
  @IsNumber()
  visibleX?: number;

  @IsOptional()
  @IsNumber()
  visibleY?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  visibleWidth?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  visibleHeight?: number;
}
