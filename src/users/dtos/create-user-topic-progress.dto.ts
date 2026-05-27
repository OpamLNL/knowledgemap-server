import { IsInt, IsOptional, IsString, IsNumber, IsDate, ValidateIf } from 'class-validator';

export class CreateUserTopicProgressDto {
    @IsString()
    userUid: string;

    @IsInt()
    topicId: number;

    @IsString()
    @IsOptional()
    status?: string;

    @IsNumber()
    @IsOptional()
    progress?: number;

    @IsDate()
    @IsOptional()
    completed_at?: Date;
}

export class MarkTopicCompleteDto {
    @ValidateIf((dto: MarkTopicCompleteDto) => dto.nodeId == null)
    @IsInt()
    topicId?: number;

    @ValidateIf((dto: MarkTopicCompleteDto) => dto.topicId == null)
    @IsInt()
    nodeId?: number;

    @IsInt()
    mapId: number;
}
