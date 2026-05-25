import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateNodeContentDto {
    @IsString()
    @IsOptional()
    theoryMd?: string | null;
}

export class UpdateNodeMediaCaptionDto {
    @IsString()
    @IsOptional()
    caption?: string | null;
}

export class NodeMediaDto {
    id: number;
    url: string;
    caption: string | null;
    sortOrder: number;
}

export class NodeContentDto {
    nodeId: number;
    theoryMd: string | null;
    media: NodeMediaDto[];
}
