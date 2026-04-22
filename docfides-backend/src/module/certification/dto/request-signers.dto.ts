import {
    ArrayMaxSize,
    ArrayNotEmpty,
    IsArray,
    IsString,
    IsUUID,
} from 'class-validator';

export class RequestSignersDto {
    @IsArray()
    @ArrayNotEmpty()
    @ArrayMaxSize(50)
    @IsString({ each: true })
    @IsUUID('4', { each: true })
    signerUserIds: string[];
}
