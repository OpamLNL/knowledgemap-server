import {
    IsArray,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MapJsonMediaDto {
    @IsString()
    @IsOptional()
    caption?: string | null;

    @IsInt()
    sortOrder: number;

    @IsString()
    @IsOptional()
    url?: string;

    @IsString()
    @IsOptional()
    dataBase64?: string;

    @IsString()
    @IsOptional()
    mimeType?: string;
}

export class MapJsonNodeDto {
    @IsString()
    @IsNotEmpty()
    key: string;

    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsOptional()
    groupId?: string | null;

    @IsNumber()
    @IsOptional()
    x?: number | null;

    @IsNumber()
    @IsOptional()
    y?: number | null;

    @IsString()
    @IsOptional()
    color?: string | null;

    @IsString()
    @IsOptional()
    theoryMd?: string | null;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MapJsonMediaDto)
    @IsOptional()
    media?: MapJsonMediaDto[];
}

export class MapJsonEdgeDto {
    @IsString()
    @IsNotEmpty()
    from: string;

    @IsString()
    @IsNotEmpty()
    to: string;

    @IsString()
    @IsOptional()
    type?: string | null;
}

export class MapJsonGroupDto {
    @IsString()
    @IsNotEmpty()
    id: string;

    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsOptional()
    description?: string | null;

    @IsInt()
    @IsOptional()
    level?: number;

    @IsInt()
    @IsOptional()
    sortOrder?: number;

    @IsString()
    @IsOptional()
    parentId?: string | null;
}

export class MapJsonGroupEdgeDto {
    @IsString()
    @IsNotEmpty()
    from: string;

    @IsString()
    @IsNotEmpty()
    to: string;

    @IsString()
    @IsOptional()
    type?: string | null;
}

export class ImportMapJsonDto {
    @IsInt()
    formatVersion: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MapJsonNodeDto)
    nodes: MapJsonNodeDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MapJsonEdgeDto)
    @IsOptional()
    edges?: MapJsonEdgeDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MapJsonGroupDto)
    @IsOptional()
    groups?: MapJsonGroupDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MapJsonGroupEdgeDto)
    @IsOptional()
    groupEdges?: MapJsonGroupEdgeDto[];

    @IsObject()
    @IsOptional()
    groupLayout?: Record<string, { x: number; y: number }>;

    @IsIn(['merge', 'replace'])
    @IsOptional()
    importMode?: 'merge' | 'replace';
}
