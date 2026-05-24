import { IsOptional, IsString } from 'class-validator';

export class UpdateTopicDto {
    @IsString()
    @IsOptional()
    title?: string;

    @IsString()
    @IsOptional()
    description?: string;
}
