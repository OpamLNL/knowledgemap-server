import { IsOptional, IsString, IsNumber, IsDate } from 'class-validator';

export class UpdateUserTopicProgressDto {
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
