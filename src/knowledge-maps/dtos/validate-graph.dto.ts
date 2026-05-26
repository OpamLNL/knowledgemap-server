import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ValidateGraphNodeDto {
    @IsInt()
    id: number;

    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsOptional()
    groupId?: string | null;
}

export class ValidateGraphEdgeDto {
    @IsInt()
    from: number;

    @IsInt()
    to: number;
}

export class ValidateGraphGroupDto {
    @IsString()
    @IsNotEmpty()
    id: string;

    @IsString()
    @IsNotEmpty()
    title: string;
}

export class ValidateGraphDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ValidateGraphNodeDto)
    nodes: ValidateGraphNodeDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ValidateGraphEdgeDto)
    edges: ValidateGraphEdgeDto[];

    @IsArray()
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => ValidateGraphGroupDto)
    groups?: ValidateGraphGroupDto[];
}
