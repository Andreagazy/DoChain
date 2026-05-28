import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class FinalizeQrDto {
  @IsInt()
  @Min(1)
  page!: number;

  @IsNumber()
  @Min(0)
  x!: number;

  @IsNumber()
  @Min(0)
  y!: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  width?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  height?: number;
}
