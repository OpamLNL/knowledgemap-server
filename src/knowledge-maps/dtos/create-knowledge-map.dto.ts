import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { MapStatus } from '../entities/knowledge-map.entity';

export class CreateKnowledgeMapDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsOptional()
    description?: string;
}

export class UpdateKnowledgeMapDto {
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
