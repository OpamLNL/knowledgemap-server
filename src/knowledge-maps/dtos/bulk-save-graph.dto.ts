import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsNumber,
    IsArray,
    ValidateNested,
    IsBoolean,
    IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BulkNodeDto {
    @IsInt()
    @IsOptional()
    id?: number;

    @IsString()
    @IsNotEmpty()
    title: string;

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

export class BulkEdgeDto {
    @IsInt()
    @IsOptional()
    id?: number;

    @IsInt()
    fromNodeId: number;

    @IsInt()
    toNodeId: number;

    @IsString()
    @IsOptional()
    type?: string | null;
}

export class BulkGroupEdgeDto {
    @IsInt()
    @IsOptional()
    id?: number;

    @IsString()
    @IsNotEmpty()
    fromGroupId: string;

    @IsString()
    @IsNotEmpty()
    toGroupId: string;

    @IsString()
    @IsOptional()
    type?: string | null;
}

export class BulkSaveGraphDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => BulkNodeDto)
    nodes: BulkNodeDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => BulkEdgeDto)
    edges: BulkEdgeDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => BulkGroupEdgeDto)
    @IsOptional()
    groupEdges?: BulkGroupEdgeDto[];

    @IsArray()
    @IsInt({ each: true })
    @IsOptional()
    deletedNodeIds?: number[];

    @IsArray()
    @IsInt({ each: true })
    @IsOptional()
    deletedEdgeIds?: number[];

    @IsArray()
    @IsInt({ each: true })
    @IsOptional()
    deletedGroupEdgeIds?: number[];

    @IsBoolean()
    @IsOptional()
    createRevision?: boolean;

    @IsString()
    @IsOptional()
    revisionComment?: string;
}

export class CreateRevisionDto {
    @IsString()
    @IsOptional()
    comment?: string;
}
