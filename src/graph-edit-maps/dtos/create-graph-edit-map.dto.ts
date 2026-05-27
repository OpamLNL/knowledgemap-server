import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { MapStatus } from '../entities/graph-edit-map.entity';

export class CreateGraphEditMapDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsOptional()
    description?: string;
}

export class UpdateGraphEditMapDto {
    @IsString()
    @IsOptional()
    title?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsEnum(MapStatus)
    @IsOptional()
    status?: MapStatus;
}
