import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsNumber,
    IsInt,
} from 'class-validator';

export class CreateNodeDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsInt()
    @IsOptional()
    topicId?: number | null;

    @IsInt()
    @IsOptional()
    mapId?: number | null;

    @IsNumber()
    @IsOptional()
    x?: number | null;

    @IsNumber()
    @IsOptional()
    y?: number | null;

    @IsString()
    @IsOptional()
    color?: string | null;
}

export class UpdateNodeDto {
    @IsString()
    @IsOptional()
    title?: string;

    @IsInt()
    @IsOptional()
    topicId?: number | null;

    @IsNumber()
    @IsOptional()
    x?: number | null;

    @IsNumber()
    @IsOptional()
    y?: number | null;

    @IsString()
    @IsOptional()
    color?: string | null;
}
