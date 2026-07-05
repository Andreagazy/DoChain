import { IsString, MinLength } from 'class-validator';

export class RequestDocumentRevokeDto {
  @IsString()
  @MinLength(10)
  reason!: string;
}
