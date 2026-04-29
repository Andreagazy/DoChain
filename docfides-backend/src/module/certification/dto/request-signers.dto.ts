import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SignerPlaceholderDto {
  @IsString()
  @IsUUID('4')
  signerUserId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  visiblePage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  visibleX?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
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

export class RequestSignersDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @IsUUID('4', { each: true })
  signerUserIds!: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SignerPlaceholderDto)
  placeholders?: SignerPlaceholderDto[];
}
