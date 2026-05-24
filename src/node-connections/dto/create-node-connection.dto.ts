import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateNodeConnectionDto {
    @IsInt()
    fromNodeId: number;

    @IsInt()
    toNodeId: number;

    @IsInt()
    @IsOptional()
    mapId?: number | null;

    @IsString()
    @IsOptional()
    type?: string | null;
}

export class UpdateNodeConnectionDto {
    @IsInt()
    @IsOptional()
    fromNodeId?: number;

    @IsInt()
    @IsOptional()
    toNodeId?: number;

    @IsString()
    @IsOptional()
    type?: string | null;
}
