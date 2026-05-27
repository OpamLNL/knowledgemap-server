import { MapStatus } from '../entities/graph-edit-map.entity';

export type MapCatalogSortBy =
    | 'title'
    | 'updatedAt'
    | 'publishedAt'
    | 'createdAt'
    | 'rating'
    | 'favorites'
    | 'favoritedAt';

export type MapCatalogSortOrder = 'asc' | 'desc';

export type MapCatalogQueryDto = {
    search?: string;
    favoritesOnly?: boolean;
    minRating?: number;
    authorId?: number;
    status?: MapStatus;
    validatedOnly?: boolean;
    sortBy?: MapCatalogSortBy;
    sortOrder?: MapCatalogSortOrder;
};

export function parseMapCatalogQuery(query: Record<string, string | undefined>): MapCatalogQueryDto {
    const sortByRaw = query.sortBy?.trim();
    const allowedSort: MapCatalogSortBy[] = [
        'title',
        'updatedAt',
        'publishedAt',
        'createdAt',
        'rating',
        'favorites',
        'favoritedAt',
    ];
    const sortBy =
        sortByRaw && allowedSort.includes(sortByRaw as MapCatalogSortBy)
            ? (sortByRaw as MapCatalogSortBy)
            : undefined;

    const sortOrderRaw = query.sortOrder?.trim();
    const sortOrder: MapCatalogSortOrder | undefined =
        sortOrderRaw === 'asc' || sortOrderRaw === 'desc' ? sortOrderRaw : undefined;

    const statusRaw = query.status?.trim();
    const status: MapStatus | undefined =
        statusRaw === MapStatus.DRAFT || statusRaw === MapStatus.PUBLISHED
            ? statusRaw
            : undefined;

    const minRatingRaw = query.minRating?.trim();
    const minRatingParsed = minRatingRaw != null && minRatingRaw !== '' ? Number(minRatingRaw) : undefined;
    const minRating =
        minRatingParsed != null && !Number.isNaN(minRatingParsed)
            ? Math.min(5, Math.max(1, Math.round(minRatingParsed)))
            : undefined;

    const authorIdRaw = query.authorId?.trim();
    const authorIdParsed = authorIdRaw != null && authorIdRaw !== '' ? Number(authorIdRaw) : undefined;
    const authorId =
        authorIdParsed != null && !Number.isNaN(authorIdParsed) && authorIdParsed > 0
            ? authorIdParsed
            : undefined;

    return {
        search: query.search?.trim() || undefined,
        favoritesOnly: query.favoritesOnly === 'true' || query.favoritesOnly === '1',
        minRating,
        authorId,
        status,
        validatedOnly: query.validatedOnly === 'true' || query.validatedOnly === '1',
        sortBy,
        sortOrder,
    };
}
