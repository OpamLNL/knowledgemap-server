import { MapStatus } from '../entities/graph-edit-map.entity';

export type MapListProgressDto = {
    total: number;
    completed: number;
    available: number;
    locked: number;
    percent: number;
};

export type MapListAuthorDto = {
    uid: string;
    name: string | null;
    email: string | null;
    displayName: string;
};

export type MapListItemDto = {
    id: number;
    title: string;
    description: string | null;
    ownerUid: string | null;
    status: MapStatus;
    graphValidated?: boolean | null;
    createdAt: Date;
    updatedAt: Date;
    publishedAt: Date | null;
    author: MapListAuthorDto;
    myProgress: MapListProgressDto | null;
};
