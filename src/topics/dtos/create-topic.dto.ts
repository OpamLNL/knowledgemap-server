import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTopicDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    description: string;

    @IsString()
    @IsOptional()
    groupId?: string;
}
