import { IsInt, IsOptional, IsString, IsNumber, IsDate } from 'class-validator';

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
    @IsInt()
    topicId: number;
}
