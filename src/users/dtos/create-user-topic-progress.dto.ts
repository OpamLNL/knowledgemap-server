export class CreateUserTopicProgressDto {
    userUid: string;
    topicId: number;
    status?: string;
    progress?: number;
    completed_at?: Date;
}
