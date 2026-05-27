import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, QueryRunner, QueryFailedError } from 'typeorm';
import { extname } from 'path';
import { randomBytes } from 'crypto';
import { GraphEditMap, MapStatus } from './entities/graph-edit-map.entity';
import { MapRevision } from './entities/map-revision.entity';
import { Node } from '../nodes/entities/node.entity';
import { NodeMedia } from '../nodes/entities/node-media.entity';
import { NodeConnection } from '../node-connections/entities/node-connection.entity';
import { Topic } from '../topics/entities/topic.entity';
import { KnowledgeGroup } from '../topics/entities/knowledge-group.entity';
import { GroupConnection } from '../topics/entities/group-connection.entity';
import { UserTopicProgress } from '../users/entities/user-topic-progress.entity';
import { CreateGraphEditMapDto, UpdateGraphEditMapDto } from './dtos/create-graph-edit-map.dto';
import { BulkSaveGraphDto, BulkNodeDto, CreateRevisionDto } from './dtos/bulk-save-graph.dto';
import { ValidateGraphDto } from './dtos/validate-graph.dto';
import { ImportMapJsonDto } from './dtos/map-json.dto';
import { GraphValidatorService } from '../common/graph/graph-validator.service';
import { UserRole } from '../users/entities/user.entity';
import { User } from '../users/entities/user.entity';
import { NodesService } from '../nodes/nodes.service';
import { UsersService } from '../users/users.service';
import type { MapListAuthorDto, MapListEngagementDto, MapListItemDto } from './dtos/map-list-item.dto';
import type { MapCatalogQueryDto, MapCatalogSortBy } from './dtos/map-catalog-query.dto';
import { UserMapFavorite } from './entities/user-map-favorite.entity';
import { UserMapRating } from './entities/user-map-rating.entity';

export type MapListViewerProfile = {
    uid: string;
    name?: string | null;
    email?: string | null;
};
import {
    filenameFromPublicUrl,
} from '../nodes/node-media.storage';
import { ImgbbService } from '../common/imgbb/imgbb.service';

export const MAP_JSON_FORMAT_VERSION = 1;
const MAX_EMBED_IMAGE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class GraphEditMapsService {
    constructor(
        @InjectRepository(GraphEditMap)
        private readonly mapRepo: Repository<GraphEditMap>,
        @InjectRepository(MapRevision)
        private readonly revisionRepo: Repository<MapRevision>,
        @InjectRepository(Node)
        private readonly nodeRepo: Repository<Node>,
        @InjectRepository(NodeConnection)
        private readonly connectionRepo: Repository<NodeConnection>,
        @InjectRepository(Topic)
        private readonly topicRepo: Repository<Topic>,
        @InjectRepository(KnowledgeGroup)
        private readonly groupRepo: Repository<KnowledgeGroup>,
        @InjectRepository(GroupConnection)
        private readonly groupConnRepo: Repository<GroupConnection>,
        @InjectRepository(NodeMedia)
        private readonly nodeMediaRepo: Repository<NodeMedia>,
        @InjectRepository(UserTopicProgress)
        private readonly progressRepo: Repository<UserTopicProgress>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(UserMapFavorite)
        private readonly favoriteRepo: Repository<UserMapFavorite>,
        @InjectRepository(UserMapRating)
        private readonly ratingRepo: Repository<UserMapRating>,
        private readonly nodesService: NodesService,
        private readonly usersService: UsersService,
        private readonly graphValidator: GraphValidatorService,
        private readonly dataSource: DataSource,
        private readonly imgbb: ImgbbService,
    ) {}

    /** Каталог: усі опубліковані карти (меню «Карти», головна). */
    async findPublished(
        viewer: MapListViewerProfile,
        query: MapCatalogQueryDto = {},
    ): Promise<MapListItemDto[]> {
        const maps = await this.mapRepo.find({
            where: { status: MapStatus.PUBLISHED },
            order: { updatedAt: 'DESC' },
            select: {
                id: true,
                title: true,
                description: true,
                ownerUid: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                publishedAt: true,
                graphValidated: true,
            },
        });
        const items = await this.enrichMapsForList(maps, viewer);
        return this.applyCatalogQuery(items, query);
    }

    /** Улюблені опубліковані карти поточного користувача. */
    async findFavorites(
        viewer: MapListViewerProfile,
        query: MapCatalogQueryDto = {},
    ): Promise<MapListItemDto[]> {
        return this.findPublished(viewer, { ...query, favoritesOnly: true });
    }

    /** @deprecated Використовуйте findPublished або findMine */
    async findAll(_userRole?: UserRole, _ownerUid?: string): Promise<MapListItemDto[]> {
        return this.findPublished({ uid: _ownerUid ?? '' });
    }

    /** Мої карти: створені користувачем + ті, що проходить/проходив. */
    async findMine(
        viewer: MapListViewerProfile,
        query: MapCatalogQueryDto = {},
    ): Promise<MapListItemDto[]> {
        const userUid = viewer.uid;
        const owned = await this.mapRepo.find({
            where: { ownerUid: userUid },
            order: { updatedAt: 'DESC' },
        });
        const ownedIds = new Set(owned.map((m) => m.id));

        const progressRows = await this.nodeRepo
            .createQueryBuilder('n')
            .innerJoin(
                UserTopicProgress,
                'p',
                'p.topic_id = n.topic_id AND p.user_uid = :uid',
                { uid: userUid },
            )
            .where('n.map_id IS NOT NULL')
            .andWhere("(p.status = 'completed' OR p.progress > 0)")
            .select('DISTINCT n.map_id', 'mapId')
            .getRawMany<{ mapId: number }>();

        const extraIds = progressRows
            .map((r) => Number(r.mapId))
            .filter((id) => id && !ownedIds.has(id));

        let fromProgress: GraphEditMap[] = [];
        if (extraIds.length > 0) {
            fromProgress = await this.mapRepo.find({
                where: { id: In(extraIds) },
                order: { updatedAt: 'DESC' },
            });
        }

        const merged = [...owned, ...fromProgress];
        merged.sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        const items = await this.enrichMapsForList(merged, viewer);
        return this.applyCatalogQuery(items, query);
    }

    private async enrichMapsForList(
        maps: GraphEditMap[],
        viewer: MapListViewerProfile,
    ): Promise<MapListItemDto[]> {
        if (maps.length === 0) return [];

        const viewerUid = viewer.uid.trim();
        const ownerUids = [
            ...new Set(
                maps.map((m) => m.ownerUid?.trim()).filter((uid): uid is string => Boolean(uid)),
            ),
        ];

        const ownerProfiles = await this.loadOwnerProfiles(ownerUids);

        if (viewerUid && ownerUids.includes(viewerUid) && !ownerProfiles.has(viewerUid)) {
            const me = await this.usersService.findByFirebaseUid(viewerUid);
            if (me) {
                ownerProfiles.set(viewerUid, { id: me.id, name: me.name, email: me.email });
            }
        }

        for (const uid of ownerUids) {
            if (ownerProfiles.has(uid)) continue;
            const profile = await this.usersService.findByFirebaseUid(uid);
            if (profile) {
                ownerProfiles.set(uid, {
                    id: profile.id,
                    name: profile.name,
                    email: profile.email,
                });
            }
        }

        const authorCache = new Map<string, MapListAuthorDto>();
        const mapIds = maps.map((m) => m.id);
        const engagementByMap = await this.loadEngagementForMaps(mapIds, viewerUid);
        const items: MapListItemDto[] = [];

        for (const map of maps) {
            let myProgress: MapListItemDto['myProgress'] = null;

            if (viewerUid && map.status === MapStatus.PUBLISHED) {
                const summary = await this.nodesService.getProgressSummary(viewerUid, map.id);
                myProgress = {
                    total: summary.total,
                    completed: summary.completed,
                    available: summary.available,
                    locked: summary.locked,
                    percent: summary.percent,
                };
            }

            items.push({
                id: map.id,
                title: map.title,
                description: map.description,
                ownerUid: map.ownerUid,
                status: map.status,
                graphValidated: map.graphValidated,
                createdAt: map.createdAt,
                updatedAt: map.updatedAt,
                publishedAt: map.publishedAt,
                author: this.resolveMapAuthor(map.ownerUid, viewer, ownerProfiles, authorCache),
                myProgress,
                engagement: engagementByMap.get(map.id) ?? this.emptyEngagement(),
            });
        }

        return items;
    }

    private emptyEngagement(): MapListEngagementDto {
        return {
            averageRating: null,
            ratingsCount: 0,
            favoritesCount: 0,
            myRating: null,
            isFavorite: false,
            favoritedAt: null,
        };
    }

    private async loadEngagementForMaps(
        mapIds: number[],
        viewerUid: string,
    ): Promise<Map<number, MapListEngagementDto>> {
        const result = new Map<number, MapListEngagementDto>();
        if (mapIds.length === 0) return result;

        for (const id of mapIds) {
            result.set(id, this.emptyEngagement());
        }

        const ratingAgg = await this.ratingRepo
            .createQueryBuilder('r')
            .select('r.map_id', 'mapId')
            .addSelect('AVG(r.rating)', 'avgRating')
            .addSelect('COUNT(*)', 'cnt')
            .where('r.map_id IN (:...ids)', { ids: mapIds })
            .groupBy('r.map_id')
            .getRawMany<{ mapId: number; avgRating: string; cnt: string }>();

        for (const row of ratingAgg) {
            const mapId = Number(row.mapId);
            const entry = result.get(mapId);
            if (!entry) continue;
            entry.ratingsCount = Number(row.cnt) || 0;
            entry.averageRating =
                entry.ratingsCount > 0 ? Math.round(Number(row.avgRating) * 10) / 10 : null;
        }

        const favoriteAgg = await this.favoriteRepo
            .createQueryBuilder('f')
            .select('f.map_id', 'mapId')
            .addSelect('COUNT(*)', 'cnt')
            .where('f.map_id IN (:...ids)', { ids: mapIds })
            .groupBy('f.map_id')
            .getRawMany<{ mapId: number; cnt: string }>();

        for (const row of favoriteAgg) {
            const mapId = Number(row.mapId);
            const entry = result.get(mapId);
            if (!entry) continue;
            entry.favoritesCount = Number(row.cnt) || 0;
        }

        const trimmedViewer = viewerUid.trim();
        if (trimmedViewer) {
            const myRatings = await this.ratingRepo.find({
                where: { userUid: trimmedViewer, mapId: In(mapIds) },
                select: { mapId: true, rating: true },
            });
            for (const row of myRatings) {
                const entry = result.get(row.mapId);
                if (entry) entry.myRating = row.rating;
            }

            const myFavorites = await this.favoriteRepo.find({
                where: { userUid: trimmedViewer, mapId: In(mapIds) },
                select: { mapId: true, createdAt: true },
            });
            for (const row of myFavorites) {
                const entry = result.get(row.mapId);
                if (entry) {
                    entry.isFavorite = true;
                    entry.favoritedAt = row.createdAt;
                }
            }
        }

        return result;
    }

    private applyCatalogQuery(items: MapListItemDto[], query: MapCatalogQueryDto): MapListItemDto[] {
        let filtered = [...items];

        if (query.search) {
            const needle = query.search.toLowerCase();
            filtered = filtered.filter(
                (item) =>
                    item.title.toLowerCase().includes(needle) ||
                    (item.description?.toLowerCase().includes(needle) ?? false) ||
                    item.author.displayName.toLowerCase().includes(needle),
            );
        }

        if (query.favoritesOnly) {
            filtered = filtered.filter((item) => item.engagement.isFavorite);
        }

        if (query.minRating != null) {
            filtered = filtered.filter(
                (item) =>
                    item.engagement.averageRating != null &&
                    item.engagement.averageRating >= query.minRating!,
            );
        }

        if (query.authorId != null) {
            filtered = filtered.filter((item) => item.author.id === query.authorId);
        }

        if (query.status != null) {
            filtered = filtered.filter((item) => item.status === query.status);
        }

        if (query.validatedOnly) {
            filtered = filtered.filter((item) => item.graphValidated === true);
        }

        return this.sortCatalogItems(filtered, query);
    }

    private sortCatalogItems(items: MapListItemDto[], query: MapCatalogQueryDto): MapListItemDto[] {
        const sortBy: MapCatalogSortBy = query.sortBy ?? 'updatedAt';
        const sortOrder = query.sortOrder ?? 'desc';
        const dir = sortOrder === 'asc' ? 1 : -1;

        const sorted = [...items];
        sorted.sort((a, b) => {
            let cmp = 0;
            switch (sortBy) {
                case 'title':
                    cmp = a.title.localeCompare(b.title, 'uk');
                    break;
                case 'publishedAt':
                    cmp = this.compareDates(a.publishedAt, b.publishedAt);
                    break;
                case 'createdAt':
                    cmp = this.compareDates(a.createdAt, b.createdAt);
                    break;
                case 'rating':
                    cmp =
                        (a.engagement.averageRating ?? 0) - (b.engagement.averageRating ?? 0) ||
                        a.engagement.ratingsCount - b.engagement.ratingsCount;
                    break;
                case 'favorites':
                    cmp =
                        a.engagement.favoritesCount - b.engagement.favoritesCount ||
                        (a.engagement.averageRating ?? 0) - (b.engagement.averageRating ?? 0);
                    break;
                case 'favoritedAt':
                    cmp = this.compareDates(a.engagement.favoritedAt, b.engagement.favoritedAt);
                    break;
                case 'updatedAt':
                default:
                    cmp = this.compareDates(a.updatedAt, b.updatedAt);
                    break;
            }
            if (cmp === 0) {
                cmp = a.title.localeCompare(b.title, 'uk');
            }
            return cmp * dir;
        });
        return sorted;
    }

    private compareDates(a: Date | null | undefined, b: Date | null | undefined): number {
        const ta = a ? new Date(a).getTime() : 0;
        const tb = b ? new Date(b).getTime() : 0;
        return ta - tb;
    }

    async setFavorite(
        mapId: number,
        viewerUid: string,
        favorite: boolean,
    ): Promise<MapListEngagementDto> {
        const map = await this.mapRepo.findOne({ where: { id: mapId } });
        if (!map) throw new NotFoundException(`Карту з id=${mapId} не знайдено`);
        if (map.status !== MapStatus.PUBLISHED) {
            throw new BadRequestException('Улюблене можна додавати лише для опублікованих карт');
        }

        const uid = viewerUid.trim();
        const existing = await this.favoriteRepo.findOne({ where: { userUid: uid, mapId } });

        if (favorite) {
            if (!existing) {
                await this.favoriteRepo.save(this.favoriteRepo.create({ userUid: uid, mapId }));
            }
        } else if (existing) {
            await this.favoriteRepo.remove(existing);
        }

        const engagement = await this.loadEngagementForMaps([mapId], uid);
        return engagement.get(mapId) ?? this.emptyEngagement();
    }

    async setRating(
        mapId: number,
        viewerUid: string,
        rating: number | null,
    ): Promise<MapListEngagementDto> {
        const map = await this.mapRepo.findOne({ where: { id: mapId } });
        if (!map) throw new NotFoundException(`Карту з id=${mapId} не знайдено`);
        if (map.status !== MapStatus.PUBLISHED) {
            throw new BadRequestException('Оцінку можна ставити лише для опублікованих карт');
        }

        const uid = viewerUid.trim();
        const existing = await this.ratingRepo.findOne({ where: { userUid: uid, mapId } });

        if (rating == null) {
            if (existing) await this.ratingRepo.remove(existing);
        } else {
            const normalized = Math.round(rating);
            if (normalized < 1 || normalized > 5) {
                throw new BadRequestException('Оцінка має бути від 1 до 5');
            }
            if (existing) {
                existing.rating = normalized;
                await this.ratingRepo.save(existing);
            } else {
                await this.ratingRepo.save(
                    this.ratingRepo.create({ userUid: uid, mapId, rating: normalized }),
                );
            }
        }

        const engagement = await this.loadEngagementForMaps([mapId], uid);
        return engagement.get(mapId) ?? this.emptyEngagement();
    }

    private async loadOwnerProfiles(
        ownerUids: string[],
    ): Promise<Map<string, Pick<User, 'id' | 'name' | 'email'>>> {
        const trimmed = [...new Set(ownerUids.map((u) => u.trim()).filter(Boolean))];
        if (trimmed.length === 0) return new Map();

        const users = await this.userRepo
            .createQueryBuilder('u')
            .select(['u.id', 'u.firebase_uid', 'u.name', 'u.email'])
            .where('TRIM(u.firebase_uid) IN (:...uids)', { uids: trimmed })
            .getMany();

        const map = new Map<string, Pick<User, 'id' | 'name' | 'email'>>();
        for (const u of users) {
            if (u.firebase_uid) {
                map.set(u.firebase_uid.trim(), {
                    id: u.id,
                    name: u.name,
                    email: u.email,
                });
            }
        }
        return map;
    }

    private resolveMapAuthor(
        ownerUid: string | null | undefined,
        viewer: MapListViewerProfile,
        ownerProfiles: Map<string, Pick<User, 'id' | 'name' | 'email'>>,
        cache: Map<string, MapListAuthorDto>,
    ): MapListAuthorDto {
        const uid = ownerUid?.trim() ?? '';
        if (!uid) {
            return {
                id: null,
                uid: '',
                name: null,
                email: null,
                displayName: 'Невідомий автор',
            };
        }

        if (cache.has(uid)) {
            return cache.get(uid)!;
        }

        const fromDb = ownerProfiles.get(uid);
        let name = fromDb?.name?.trim() || null;
        let email = fromDb?.email?.trim() || null;

        if (!name && !email && viewer.uid.trim() === uid) {
            name = viewer.name?.trim() || null;
            email = viewer.email?.trim() || null;
        }

        const author = this.authorFromProfile(
            uid,
            fromDb?.id ?? null,
            name,
            email,
        );
        cache.set(uid, author);
        return author;
    }

    private authorFromProfile(
        uid: string,
        userId: number | null,
        name: string | null | undefined,
        email: string | null | undefined,
    ): MapListAuthorDto {
        const trimmedName = name?.trim() || null;
        const trimmedEmail = email?.trim() || null;
        return {
            id: userId,
            uid,
            name: trimmedName,
            email: trimmedEmail,
            displayName:
                trimmedName ||
                trimmedEmail?.split('@')[0]?.trim() ||
                'Невідомий автор',
        };
    }

    async findOne(id: number, userUid?: string, userRole?: UserRole): Promise<GraphEditMap> {
        const map = await this.mapRepo.findOne({ where: { id } });
        if (!map) throw new NotFoundException(`Карту з id=${id} не знайдено`);
        if (userUid !== undefined && userRole !== undefined) {
            this.assertCanViewMap(map, userUid, userRole);
        }
        return map;
    }

    async create(dto: CreateGraphEditMapDto, ownerUid: string): Promise<GraphEditMap> {
        const map = this.mapRepo.create({
            title: dto.title,
            description: dto.description ?? null,
            ownerUid,
            status: MapStatus.DRAFT,
        });
        return this.mapRepo.save(map);
    }

    async update(id: number, dto: UpdateGraphEditMapDto, userUid: string, userRole: UserRole): Promise<GraphEditMap> {
        const map = await this.findOne(id);
        this.assertCanEdit(map, userUid, userRole);

        if (dto.title !== undefined) map.title = dto.title;
        if (dto.description !== undefined) map.description = dto.description ?? null;
        if (!map.ownerUid && (userRole === UserRole.ADMIN || userRole === UserRole.TEACHER)) {
            map.ownerUid = userUid;
        }

        if (dto.status !== undefined) {
            if (dto.status === MapStatus.PUBLISHED) {
                map.publishedAt = new Date();
            }
            map.status = dto.status;
        }

        return this.mapRepo.save(map);
    }

    async remove(id: number, userUid: string, userRole: UserRole): Promise<void> {
        const map = await this.findOne(id);
        this.assertCanEdit(map, userUid, userRole);

        await this.dataSource.transaction(async (manager) => {
            await manager.delete(NodeConnection, { mapId: id });
            await manager.delete(Node, { mapId: id });
            await manager.delete(GroupConnection, { mapId: id });
            await manager.delete(KnowledgeGroup, { mapId: id });
            await manager.delete(MapRevision, { mapId: id });
            await manager.delete(GraphEditMap, { id });
        });
    }

    async publish(id: number, userUid: string, userRole: UserRole): Promise<GraphEditMap> {
        const map = await this.findOne(id);
        this.assertCanEdit(map, userUid, userRole);

        const graph = await this.buildEditorGraphData(id);
        const validation = await this.validateMapGraphStrict(id, graph);

        await this.createRevision(id, userUid, userRole, 'Авто-знімок перед публікацією');

        map.status = MapStatus.PUBLISHED;
        map.publishedAt = new Date();
        map.graphValidated = validation.valid;
        if (!map.ownerUid) {
            map.ownerUid = userUid;
        }
        return this.mapRepo.save(map);
    }

    async getEditorGraph(mapId: number, userUid: string, userRole: UserRole) {
        const map = await this.findOne(mapId);
        this.assertCanEdit(map, userUid, userRole);
        return this.buildEditorGraphData(mapId);
    }

    private async buildEditorGraphData(mapId: number) {
        const nodes = await this.nodeRepo.find({ where: { mapId } });
        const edges = await this.connectionRepo.find({ where: { mapId } });

        return {
            mapId,
            nodes: nodes.map((n) => ({
                id: n.id,
                title: n.title,
                topicId: n.topicId,
                groupId: n.groupId,
                x: n.x,
                y: n.y,
                color: n.color,
            })),
            edges: edges.map((e) => ({
                id: e.id,
                fromNodeId: e.fromNodeId,
                toNodeId: e.toNodeId,
                type: e.type,
            })),
        };
    }

    async validateGraph(mapId: number, userUid: string, userRole: UserRole) {
        const map = await this.findOne(mapId);
        this.assertCanEdit(map, userUid, userRole);
        const graph = await this.buildEditorGraphData(mapId);
        return this.validateMapGraphStrict(mapId, graph);
    }

    /** Валідація чернетки з редактора (може містити незбережені зміни). */
    async validateGraphDraft(
        mapId: number,
        dto: ValidateGraphDto,
        userUid: string,
        userRole: UserRole,
    ) {
        const map = await this.findOne(mapId);
        this.assertCanEdit(map, userUid, userRole);

        const dbGroups = await this.groupRepo.find({ where: { mapId } });
        const groupTitleById: Record<string, string> = Object.fromEntries(
            dbGroups.map((g) => [g.id, g.title]),
        );
        for (const g of dto.groups ?? []) {
            groupTitleById[g.id] = g.title;
        }

        return this.graphValidator.validate(
            dto.nodes.map((n) => ({
                id: n.id,
                title: n.title,
                groupId: n.groupId ?? null,
            })),
            dto.edges.map((e) => ({ from: e.from, to: e.to })),
            {
                strictCycles: true,
                strictIsolation: true,
                groupTitleById,
            },
        );
    }

    /** Сувора валідація для UI «Валідувати» та публікації. */
    private async validateMapGraphStrict(
        mapId: number,
        graph: Awaited<ReturnType<GraphEditMapsService['buildEditorGraphData']>>,
    ) {
        const knowledgeGroups = await this.groupRepo.find({ where: { mapId } });
        const groupTitleById = Object.fromEntries(
            knowledgeGroups.map((g) => [g.id, g.title]),
        ) as Record<string, string>;

        return this.graphValidator.validate(
            graph.nodes.map((n) => ({
                id: n.id,
                title: n.title,
                groupId: n.groupId ?? null,
            })),
            graph.edges.map((e) => ({
                from: e.fromNodeId,
                to: e.toNodeId,
                id: e.id,
            })),
            {
                strictCycles: true,
                strictIsolation: true,
                groupTitleById,
            },
        );
    }

    async bulkSave(
        mapId: number,
        dto: BulkSaveGraphDto,
        userUid: string,
        userRole: UserRole,
    ) {
        const map = await this.findOne(mapId);
        this.assertCanEdit(map, userUid, userRole);

        if (map.status === MapStatus.PUBLISHED) {
            await this.createRevision(
                mapId,
                userUid,
                userRole,
                'Auto-snapshot перед редагуванням опублікованої карти',
            );
            map.status = MapStatus.DRAFT;
            await this.mapRepo.save(map);
        }

        if (dto.createRevision) {
            await this.createRevision(
                mapId,
                userUid,
                userRole,
                dto.revisionComment ?? 'Знімок перед збереженням',
            );
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const idRemap = new Map<number, number>();

            if (dto.deletedEdgeIds?.length) {
                await queryRunner.manager.delete(NodeConnection, {
                    id: In(dto.deletedEdgeIds),
                    mapId,
                });
            }

            if (dto.deletedNodeIds?.length) {
                await queryRunner.manager.delete(NodeConnection, {
                    mapId,
                    fromNodeId: In(dto.deletedNodeIds),
                });
                await queryRunner.manager.delete(NodeConnection, {
                    mapId,
                    toNodeId: In(dto.deletedNodeIds),
                });
                await queryRunner.manager.delete(Node, {
                    id: In(dto.deletedNodeIds),
                    mapId,
                });
            }

            if (dto.deletedGroupEdgeIds?.length) {
                await queryRunner.manager.delete(GroupConnection, {
                    id: In(dto.deletedGroupEdgeIds),
                    mapId,
                });
            }

            if (dto.deletedGroupIds?.length) {
                const validDelete = dto.deletedGroupIds.filter(Boolean);
                if (validDelete.length > 0) {
                    const nodesInGroups = await queryRunner.manager.find(Node, {
                        where: { mapId, groupId: In(validDelete) },
                    });
                    const nodeIds = nodesInGroups.map((n) => n.id);
                    if (nodeIds.length > 0) {
                        await queryRunner.manager.delete(NodeConnection, {
                            mapId,
                            fromNodeId: In(nodeIds),
                        });
                        await queryRunner.manager.delete(NodeConnection, {
                            mapId,
                            toNodeId: In(nodeIds),
                        });
                        await queryRunner.manager.delete(Node, {
                            id: In(nodeIds),
                            mapId,
                        });
                    }
                    await queryRunner.manager
                        .createQueryBuilder()
                        .delete()
                        .from(GroupConnection)
                        .where('map_id = :mapId', { mapId })
                        .andWhere(
                            '(from_group_id IN (:...ids) OR to_group_id IN (:...ids))',
                            { ids: validDelete },
                        )
                        .execute();
                    await queryRunner.manager.delete(KnowledgeGroup, {
                        id: In(validDelete),
                        mapId,
                    });
                }
            }

            if (dto.groups?.length) {
                for (const groupDto of dto.groups) {
                    const existing = await queryRunner.manager.findOne(KnowledgeGroup, {
                        where: { id: groupDto.id },
                    });
                    if (existing) {
                        if (existing.mapId !== mapId) {
                            throw new BadRequestException(
                                `Група ${groupDto.id} належить іншій карті`,
                            );
                        }
                        Object.assign(existing, {
                            title: groupDto.title,
                            description: groupDto.description ?? null,
                            level: groupDto.level ?? existing.level,
                            sortOrder: groupDto.sortOrder ?? existing.sortOrder,
                            parentId:
                                groupDto.parentId !== undefined
                                    ? groupDto.parentId
                                    : existing.parentId,
                        });
                        await queryRunner.manager.save(existing);
                    } else {
                        await queryRunner.manager.save(
                            queryRunner.manager.create(KnowledgeGroup, {
                                id: groupDto.id,
                                mapId,
                                title: groupDto.title,
                                description: groupDto.description ?? null,
                                level: groupDto.level ?? 0,
                                sortOrder: groupDto.sortOrder ?? 0,
                                parentId: groupDto.parentId ?? null,
                            }),
                        );
                    }
                }
            }

            for (const nodeDto of dto.nodes) {
                let topic: Topic | null = null;
                if (nodeDto.topicId) {
                    topic = await queryRunner.manager.findOne(Topic, {
                        where: { id: nodeDto.topicId },
                    });
                    if (!topic) {
                        throw new BadRequestException(`Topic id=${nodeDto.topicId} не існує`);
                    }
                }

                let existing: Node | null = null;
                if (nodeDto.id !== undefined && nodeDto.id > 0) {
                    existing = await queryRunner.manager.findOne(Node, {
                        where: { id: nodeDto.id, mapId },
                    });
                    if (!existing) {
                        throw new NotFoundException(
                            `Node id=${nodeDto.id} не знайдено на карті ${mapId}`,
                        );
                    }
                }

                const groupIdForSave = this.resolveNodeGroupIdForSave(nodeDto, topic);
                const effectiveGroupId =
                    groupIdForSave ?? topic?.groupId ?? existing?.groupId ?? null;

                let topicIdForSave = nodeDto.topicId ?? existing?.topicId ?? null;

                if (!topicIdForSave && effectiveGroupId) {
                    topic = await this.createTopicForNodeInTransaction(
                        queryRunner,
                        nodeDto.title,
                        effectiveGroupId,
                    );
                    topicIdForSave = topic.id;
                } else if (topic) {
                    const trimmedTitle = nodeDto.title.trim() || 'Новий вузол';
                    let topicDirty = false;
                    if (topic.title !== trimmedTitle) {
                        topic.title = trimmedTitle;
                        topic.description = trimmedTitle;
                        topicDirty = true;
                    }
                    if (effectiveGroupId && topic.groupId !== effectiveGroupId) {
                        topic.groupId = effectiveGroupId;
                        topicDirty = true;
                    }
                    if (topicDirty) {
                        await queryRunner.manager.save(topic);
                    }
                }

                if (existing) {
                    Object.assign(existing, {
                        title: nodeDto.title,
                        topicId: topicIdForSave,
                        color: nodeDto.color ?? null,
                    });
                    if (groupIdForSave !== undefined) {
                        existing.groupId = groupIdForSave;
                    }
                    if (nodeDto.x !== undefined) existing.x = nodeDto.x;
                    if (nodeDto.y !== undefined) existing.y = nodeDto.y;
                    await queryRunner.manager.save(existing);
                } else {
                    const tempKey = nodeDto.id;
                    const created = await queryRunner.manager.save(
                        queryRunner.manager.create(Node, {
                            title: nodeDto.title,
                            topicId: topicIdForSave,
                            groupId: groupIdForSave ?? effectiveGroupId ?? null,
                            mapId,
                            x: nodeDto.x ?? null,
                            y: nodeDto.y ?? null,
                            color: nodeDto.color ?? null,
                        }),
                    );
                    if (tempKey !== undefined && tempKey < 0) {
                        idRemap.set(tempKey, created.id);
                    }
                }
            }

            const resolveNodeId = (id: number): number => {
                if (id < 0) {
                    const mapped = idRemap.get(id);
                    if (!mapped) {
                        throw new BadRequestException(`Тимчасовий id вузла ${id} не знайдено після створення`);
                    }
                    return mapped;
                }
                return id;
            };

            const allNodes = await queryRunner.manager.find(Node, { where: { mapId } });
            const nodeIdSet = new Set(allNodes.map((n) => n.id));

            for (const edgeDto of dto.edges) {
                const fromNodeId = resolveNodeId(edgeDto.fromNodeId);
                const toNodeId = resolveNodeId(edgeDto.toNodeId);

                if (!nodeIdSet.has(fromNodeId) || !nodeIdSet.has(toNodeId)) {
                    throw new BadRequestException(
                        `Ребро ${fromNodeId}→${toNodeId} посилається на неіснуючі вузли`,
                    );
                }

                if (edgeDto.id && edgeDto.id > 0) {
                    const existing = await queryRunner.manager.findOne(NodeConnection, {
                        where: { id: edgeDto.id, mapId },
                    });
                    if (existing) {
                        Object.assign(existing, {
                            fromNodeId,
                            toNodeId,
                            type: edgeDto.type ?? null,
                        });
                        await queryRunner.manager.save(existing);
                        continue;
                    }
                }

                const duplicate = await queryRunner.manager.findOne(NodeConnection, {
                    where: {
                        mapId,
                        fromNodeId,
                        toNodeId,
                    },
                });
                if (!duplicate) {
                    await queryRunner.manager.save(
                        queryRunner.manager.create(NodeConnection, {
                            fromNodeId,
                            toNodeId,
                            mapId,
                            type: edgeDto.type ?? null,
                        }),
                    );
                }
            }

            if (dto.groupEdges?.length) {
                const groupIds = new Set(
                    (await queryRunner.manager.find(KnowledgeGroup, { where: { mapId } })).map(
                        (g) => g.id,
                    ),
                );

                for (const edgeDto of dto.groupEdges) {
                    if (!groupIds.has(edgeDto.fromGroupId) || !groupIds.has(edgeDto.toGroupId)) {
                        throw new BadRequestException(
                            `Group edge ${edgeDto.fromGroupId}→${edgeDto.toGroupId} посилається на неіснуючі групи`,
                        );
                    }

                    if (edgeDto.id && edgeDto.id > 0) {
                        const existing = await queryRunner.manager.findOne(GroupConnection, {
                            where: { id: edgeDto.id, mapId },
                        });
                        if (existing) {
                            Object.assign(existing, {
                                fromGroupId: edgeDto.fromGroupId,
                                toGroupId: edgeDto.toGroupId,
                                type: edgeDto.type ?? 'prerequisite',
                            });
                            await queryRunner.manager.save(existing);
                            continue;
                        }
                    }

                    const duplicate = await queryRunner.manager.findOne(GroupConnection, {
                        where: {
                            mapId,
                            fromGroupId: edgeDto.fromGroupId,
                            toGroupId: edgeDto.toGroupId,
                        },
                    });
                    if (!duplicate) {
                        await queryRunner.manager.save(
                            queryRunner.manager.create(GroupConnection, {
                                mapId,
                                fromGroupId: edgeDto.fromGroupId,
                                toGroupId: edgeDto.toGroupId,
                                type: edgeDto.type ?? 'prerequisite',
                                source: 'editor',
                            }),
                        );
                    }
                }
            }

            if (dto.groupLayouts !== undefined && dto.groupLayouts.length > 0) {
                const freshMap = await queryRunner.manager.findOne(GraphEditMap, {
                    where: { id: mapId },
                });
                if (!freshMap) {
                    throw new NotFoundException(`Карту id=${mapId} не знайдено`);
                }
                const layout: Record<string, { x: number; y: number }> = {
                    ...(freshMap.groupLayoutJson ?? {}),
                };
                for (const item of dto.groupLayouts) {
                    layout[item.groupId] = {
                        x: Math.round(item.x),
                        y: Math.round(item.y),
                    };
                }
                freshMap.groupLayoutJson = layout;
                await queryRunner.manager.save(GraphEditMap, freshMap);
                map.groupLayoutJson = layout;
            }

            await queryRunner.commitTransaction();
        } catch (err) {
            await queryRunner.rollbackTransaction();
            if (err instanceof QueryFailedError) {
                throw new BadRequestException(`Помилка збереження графа: ${err.message}`);
            }
            throw err;
        } finally {
            await queryRunner.release();
        }

        map.updatedAt = new Date();
        await this.mapRepo.save(map);

        return this.buildEditorGraphData(mapId);
    }

    async createRevision(
        mapId: number,
        userUid: string,
        userRole: UserRole,
        comment?: string,
    ): Promise<MapRevision> {
        const map = await this.findOne(mapId);
        this.assertCanEdit(map, userUid, userRole);
        const graph = await this.buildEditorGraphData(mapId);
        const revision = this.revisionRepo.create({
            mapId,
            snapshotJson: {
                nodes: graph.nodes,
                edges: graph.edges,
            },
            comment: comment ?? null,
            createdByUid: userUid,
        });
        return this.revisionRepo.save(revision);
    }

    async listRevisions(
        mapId: number,
        userUid: string,
        userRole: UserRole,
    ): Promise<MapRevision[]> {
        const map = await this.findOne(mapId);
        this.assertCanEdit(map, userUid, userRole);
        return this.revisionRepo.find({
            where: { mapId },
            order: { createdAt: 'DESC' },
        });
    }

    async restoreRevision(
        mapId: number,
        revisionId: number,
        userUid: string,
        userRole: UserRole,
    ) {
        const revision = await this.revisionRepo.findOne({
            where: { id: revisionId, mapId },
        });
        if (!revision) {
            throw new NotFoundException(`Ревізію id=${revisionId} не знайдено`);
        }

        const { nodes, edges } = revision.snapshotJson;

        return this.bulkSave(
            mapId,
            {
                nodes: nodes.map((n: Record<string, unknown>) => ({
                    id: n.id as number,
                    title: n.title as string,
                    topicId: (n.topicId as number) ?? null,
                    x: (n.x as number) ?? null,
                    y: (n.y as number) ?? null,
                    color: (n.color as string) ?? null,
                })),
                edges: edges.map((e: Record<string, unknown>) => ({
                    id: e.id as number | undefined,
                    fromNodeId: e.fromNodeId as number,
                    toNodeId: e.toNodeId as number,
                    type: (e.type as string) ?? null,
                })),
                createRevision: true,
                revisionComment: `Відновлено з ревізії #${revisionId}`,
            },
            userUid,
            userRole,
        );
    }

    async getDefaultMapId(): Promise<number> {
        const published = await this.mapRepo.findOne({
            where: { status: MapStatus.PUBLISHED },
            order: { id: 'ASC' },
        });
        if (published) return published.id;

        const any = await this.mapRepo.findOne({ order: { id: 'ASC' } });
        if (!any) throw new NotFoundException('Жодної карти знань не знайдено');
        return any.id;
    }

    async exportJson(mapId: number, userUid: string, userRole: UserRole) {
        const map = await this.findOne(mapId);
        this.assertCanEdit(map, userUid, userRole);

        const nodes = await this.nodeRepo.find({ where: { mapId } });
        const edges = await this.connectionRepo.find({ where: { mapId } });
        const groups = await this.groupRepo.find({
            where: { mapId },
            order: { sortOrder: 'ASC' },
        });
        const groupEdges = await this.groupConnRepo.find({ where: { mapId } });

        const nodeIds = nodes.map((n) => n.id);
        const mediaRows =
            nodeIds.length > 0
                ? await this.nodeMediaRepo.find({
                      where: { nodeId: In(nodeIds) },
                      order: { sortOrder: 'ASC', id: 'ASC' },
                  })
                : [];
        const mediaByNodeId = new Map<number, NodeMedia[]>();
        for (const m of mediaRows) {
            const list = mediaByNodeId.get(m.nodeId) ?? [];
            list.push(m);
            mediaByNodeId.set(m.nodeId, list);
        }

        let embeddedImages = 0;
        let skippedImages = 0;

        const exportNodes = await Promise.all(
            nodes.map(async (n) => {
                const key = `node-${n.id}`;
                const media = await Promise.all(
                    (mediaByNodeId.get(n.id) ?? []).map(async (item) => {
                        const base: {
                            caption: string | null;
                            sortOrder: number;
                            url?: string;
                            dataBase64?: string;
                            mimeType?: string;
                        } = {
                            caption: item.caption,
                            sortOrder: item.sortOrder,
                            url: item.url,
                        };

                        if (!this.imgbb.isHostedImageUrl(item.url)) {
                            skippedImages++;
                            return base;
                        }

                        try {
                            const buf = await this.imgbb.readImageBytes(item.url);
                            if (!buf || buf.length > MAX_EMBED_IMAGE_BYTES) {
                                skippedImages++;
                                return base;
                            }
                            base.dataBase64 = buf.toString('base64');
                            base.mimeType = mimeFromUrl(item.url);
                            embeddedImages++;
                        } catch {
                            skippedImages++;
                        }
                        return base;
                    }),
                );

                return {
                    key,
                    title: n.title,
                    groupId: n.groupId,
                    x: n.x,
                    y: n.y,
                    color: n.color,
                    theoryMd: n.theoryMd,
                    media,
                };
            }),
        );

        const keyByNodeId = new Map(nodes.map((n) => [n.id, `node-${n.id}`]));

        return {
            formatVersion: MAP_JSON_FORMAT_VERSION,
            exportedAt: new Date().toISOString(),
            map: {
                title: map.title,
                description: map.description,
            },
            groups: groups.map((g) => ({
                id: g.id,
                title: g.title,
                description: g.description,
                level: g.level,
                sortOrder: g.sortOrder,
                parentId: g.parentId,
            })),
            groupEdges: groupEdges.map((e) => ({
                from: e.fromGroupId,
                to: e.toGroupId,
                type: e.type,
            })),
            groupLayout: map.groupLayoutJson ?? {},
            nodes: exportNodes,
            edges: edges.map((e) => ({
                from: keyByNodeId.get(e.fromNodeId) ?? String(e.fromNodeId),
                to: keyByNodeId.get(e.toNodeId) ?? String(e.toNodeId),
                type: e.type,
            })),
            mediaNote:
                'Зображення (ImgBB або legacy uploads) вбудовані як dataBase64. Інші URL лишаються посиланнями.',
            mediaStats: { embeddedImages, skippedImages },
        };
    }

    async importJson(
        mapId: number,
        dto: ImportMapJsonDto,
        userUid: string,
        userRole: UserRole,
    ) {
        const map = await this.findOne(mapId);
        this.assertCanEdit(map, userUid, userRole);

        if (dto.formatVersion !== MAP_JSON_FORMAT_VERSION) {
            throw new BadRequestException(
                `Непідтримувана версія JSON (formatVersion=${dto.formatVersion})`,
            );
        }
        if (!dto.nodes?.length) {
            throw new BadRequestException('JSON не містить вузлів (nodes)');
        }

        const mode = dto.importMode ?? 'merge';
        const nodeKeys = new Set(dto.nodes.map((n) => n.key));
        for (const edge of dto.edges ?? []) {
            if (!nodeKeys.has(edge.from) || !nodeKeys.has(edge.to)) {
                throw new BadRequestException(
                    `Ребро ${edge.from}→${edge.to} посилається на невідомий key вузла`,
                );
            }
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            if (mode === 'replace') {
                await this.clearMapGraph(queryRunner, mapId);
            }

            if (map.status === MapStatus.PUBLISHED) {
                const freshMap = await queryRunner.manager.findOne(GraphEditMap, {
                    where: { id: mapId },
                });
                if (freshMap) {
                    freshMap.status = MapStatus.DRAFT;
                    await queryRunner.manager.save(freshMap);
                }
            }

            const importGroups = dto.groups ?? [];
            const groupIdMap = new Map<string, string>();

            for (const g of importGroups) {
                const existing = await queryRunner.manager.findOne(KnowledgeGroup, {
                    where: { id: g.id },
                });
                if (existing?.mapId === mapId) {
                    groupIdMap.set(g.id, g.id);
                } else {
                    groupIdMap.set(g.id, this.generateGroupId());
                }
            }

            const groupIds = new Set(
                (await queryRunner.manager.find(KnowledgeGroup, { where: { mapId } })).map(
                    (g) => g.id,
                ),
            );

            for (const g of importGroups) {
                const targetId = groupIdMap.get(g.id)!;
                const parentId = g.parentId
                    ? (groupIdMap.get(g.parentId) ?? null)
                    : null;

                const existingInTarget = await queryRunner.manager.findOne(KnowledgeGroup, {
                    where: { id: targetId },
                });
                if (existingInTarget) {
                    if (existingInTarget.mapId !== mapId) {
                        throw new BadRequestException(
                            `Група ${targetId} належить іншій карті`,
                        );
                    }
                    Object.assign(existingInTarget, {
                        title: g.title,
                        description: g.description ?? null,
                        level: g.level ?? existingInTarget.level,
                        sortOrder: g.sortOrder ?? existingInTarget.sortOrder,
                        parentId,
                    });
                    await queryRunner.manager.save(existingInTarget);
                } else {
                    await queryRunner.manager.save(
                        queryRunner.manager.create(KnowledgeGroup, {
                            id: targetId,
                            mapId,
                            title: g.title,
                            description: g.description ?? null,
                            level: g.level ?? 0,
                            sortOrder: g.sortOrder ?? 0,
                            parentId,
                        }),
                    );
                }
                groupIds.add(targetId);
            }

            const keyToNodeId = new Map<string, number>();

            for (const nodeDto of dto.nodes) {
                const remappedGroupId = nodeDto.groupId
                    ? (groupIdMap.get(nodeDto.groupId) ?? nodeDto.groupId)
                    : null;
                if (remappedGroupId && !groupIds.has(remappedGroupId)) {
                    throw new BadRequestException(
                        `Вузол ${nodeDto.key} посилається на неіснуючу групу ${nodeDto.groupId}`,
                    );
                }

                let topic: Topic | null = null;
                if (remappedGroupId) {
                    topic = await this.createTopicForNodeInTransaction(
                        queryRunner,
                        nodeDto.title,
                        remappedGroupId,
                    );
                }

                const created = await queryRunner.manager.save(
                    queryRunner.manager.create(Node, {
                        title: nodeDto.title,
                        topicId: topic?.id ?? null,
                        groupId: remappedGroupId,
                        mapId,
                        x: nodeDto.x ?? null,
                        y: nodeDto.y ?? null,
                        color: nodeDto.color ?? null,
                        theoryMd: nodeDto.theoryMd ?? null,
                    }),
                );
                keyToNodeId.set(nodeDto.key, created.id);

                if (nodeDto.media?.length) {
                    await this.importNodeMedia(queryRunner, created.id, nodeDto.media);
                }
            }

            for (const edgeDto of dto.edges ?? []) {
                const fromNodeId = keyToNodeId.get(edgeDto.from)!;
                const toNodeId = keyToNodeId.get(edgeDto.to)!;

                const duplicate = await queryRunner.manager.findOne(NodeConnection, {
                    where: { mapId, fromNodeId, toNodeId },
                });
                if (!duplicate) {
                    await queryRunner.manager.save(
                        queryRunner.manager.create(NodeConnection, {
                            mapId,
                            fromNodeId,
                            toNodeId,
                            type: edgeDto.type ?? null,
                        }),
                    );
                }
            }

            for (const ge of dto.groupEdges ?? []) {
                const fromId = groupIdMap.get(ge.from) ?? ge.from;
                const toId = groupIdMap.get(ge.to) ?? ge.to;
                if (!groupIds.has(fromId) || !groupIds.has(toId)) continue;
                const duplicate = await queryRunner.manager.findOne(GroupConnection, {
                    where: { mapId, fromGroupId: fromId, toGroupId: toId },
                });
                if (!duplicate) {
                    await queryRunner.manager.save(
                        queryRunner.manager.create(GroupConnection, {
                            mapId,
                            fromGroupId: fromId,
                            toGroupId: toId,
                            type: ge.type ?? 'prerequisite',
                            source: 'import',
                        }),
                    );
                }
            }

            if (dto.groupLayout && Object.keys(dto.groupLayout).length > 0) {
                const remappedLayout: Record<string, { x: number; y: number }> = {};
                for (const [oldId, pos] of Object.entries(dto.groupLayout)) {
                    remappedLayout[groupIdMap.get(oldId) ?? oldId] = pos;
                }
                const freshMap = await queryRunner.manager.findOne(GraphEditMap, {
                    where: { id: mapId },
                });
                if (freshMap) {
                    freshMap.groupLayoutJson = {
                        ...(mode === 'merge' ? (freshMap.groupLayoutJson ?? {}) : {}),
                        ...remappedLayout,
                    };
                    await queryRunner.manager.save(freshMap);
                }
            }

            await queryRunner.commitTransaction();
        } catch (err) {
            await queryRunner.rollbackTransaction();
            if (err instanceof QueryFailedError) {
                throw new BadRequestException(`Помилка імпорту: ${err.message}`);
            }
            throw err;
        } finally {
            await queryRunner.release();
        }

        map.updatedAt = new Date();
        await this.mapRepo.save(map);

        return {
            mapId,
            importMode: mode,
            importedNodes: dto.nodes.length,
            importedEdges: dto.edges?.length ?? 0,
            graph: await this.buildEditorGraphData(mapId),
        };
    }

    private generateGroupId(): string {
        return `g_${Date.now().toString(36)}_${randomBytes(3).toString('hex').slice(0, 6)}`;
    }

    private async clearMapGraph(queryRunner: QueryRunner, mapId: number): Promise<void> {
        const nodes = await queryRunner.manager.find(Node, { where: { mapId } });
        const nodeIds = nodes.map((n) => n.id);
        if (nodeIds.length > 0) {
            await queryRunner.manager.delete(NodeMedia, { nodeId: In(nodeIds) });
        }
        await queryRunner.manager.delete(NodeConnection, { mapId });
        await queryRunner.manager.delete(Node, { mapId });
        await queryRunner.manager.delete(GroupConnection, { mapId });
        await queryRunner.manager.delete(KnowledgeGroup, { mapId });
    }

    private async importNodeMedia(
        queryRunner: QueryRunner,
        nodeId: number,
        media: ImportMapJsonDto['nodes'][number]['media'],
    ): Promise<void> {
        if (!media?.length) return;

        for (const item of media) {
            let url: string | null = null;
            let deleteUrl: string | null = null;

            if (item.dataBase64) {
                const buf = Buffer.from(item.dataBase64, 'base64');
                if (buf.length > MAX_EMBED_IMAGE_BYTES) continue;
                const uploaded = await this.imgbb.uploadImage(buf, `node-${nodeId}-import`);
                url = uploaded.url;
                deleteUrl = uploaded.deleteUrl;
            } else if (item.url) {
                if (item.url.startsWith('http://') || item.url.startsWith('https://')) {
                    url = item.url;
                } else if (filenameFromPublicUrl(item.url)) {
                    const buf = await this.imgbb.readImageBytes(item.url);
                    if (buf && buf.length <= MAX_EMBED_IMAGE_BYTES) {
                        const uploaded = await this.imgbb.uploadImage(buf, `node-${nodeId}-import`);
                        url = uploaded.url;
                        deleteUrl = uploaded.deleteUrl;
                    }
                }
            }

            if (!url) continue;

            await queryRunner.manager.save(
                queryRunner.manager.create(NodeMedia, {
                    nodeId,
                    url,
                    deleteUrl,
                    caption: item.caption?.trim() || null,
                    sortOrder: item.sortOrder ?? 0,
                }),
            );
        }
    }

    async getImportLibrary(
        mapId: number,
        userUid: string,
        userRole: UserRole,
        search?: string,
        sourceMapId?: number,
    ) {
        const map = await this.findOne(mapId);
        this.assertCanEdit(map, userUid, userRole);

        const qb = this.mapRepo
            .createQueryBuilder('m')
            .where('m.id != :mapId', { mapId });

        if (userRole !== UserRole.ADMIN) {
            qb.andWhere('m.owner_uid = :uid', { uid: userUid });
        }
        if (sourceMapId != null && !Number.isNaN(sourceMapId)) {
            qb.andWhere('m.id = :sourceMapId', { sourceMapId });
        }

        const maps = await qb.orderBy('m.updated_at', 'DESC').getMany();
        if (maps.length === 0) {
            return { maps: [], groups: [], nodes: [] };
        }

        const mapIds = maps.map((m) => m.id);
        const mapTitleById = new Map(maps.map((m) => [m.id, m.title]));
        const q = search?.trim();

        let groupsQuery = this.groupRepo
            .createQueryBuilder('g')
            .where('g.map_id IN (:...mapIds)', { mapIds });
        if (q) {
            groupsQuery = groupsQuery.andWhere(
                '(g.title LIKE :search OR g.description LIKE :search)',
                { search: `%${q}%` },
            );
        }
        const groups = await groupsQuery.orderBy('g.sort_order', 'ASC').getMany();

        let nodesQuery = this.nodeRepo
            .createQueryBuilder('n')
            .where('n.map_id IN (:...mapIds)', { mapIds });
        if (q) {
            nodesQuery = nodesQuery.andWhere('n.title LIKE :search', { search: `%${q}%` });
        }
        const nodes = await nodesQuery.getMany();

        const nodeCountByGroup = new Map<string, number>();
        for (const n of nodes) {
            if (!n.groupId) continue;
            const key = `${n.mapId}:${n.groupId}`;
            nodeCountByGroup.set(key, (nodeCountByGroup.get(key) ?? 0) + 1);
        }

        const groupTitleById = new Map(groups.map((g) => [g.id, g.title]));

        return {
            maps: maps.map((m) => ({
                id: m.id,
                title: m.title,
                status: m.status,
            })),
            groups: groups.map((g) => ({
                id: g.id,
                title: g.title,
                description: g.description,
                level: g.level,
                sortOrder: g.sortOrder,
                mapId: g.mapId,
                mapTitle: mapTitleById.get(g.mapId) ?? '',
                nodeCount: nodeCountByGroup.get(`${g.mapId}:${g.id}`) ?? 0,
            })),
            nodes: nodes.map((n) => ({
                id: n.id,
                title: n.title,
                mapId: n.mapId!,
                mapTitle: n.mapId != null ? (mapTitleById.get(n.mapId) ?? '') : '',
                groupId: n.groupId,
                groupTitle: n.groupId ? (groupTitleById.get(n.groupId) ?? null) : null,
                topicId: n.topicId,
            })),
        };
    }

    private assertCanViewMap(map: GraphEditMap, userUid: string, userRole: UserRole): void {
        if (map.status === MapStatus.PUBLISHED) return;
        this.assertCanEdit(map, userUid, userRole);
    }

    private assertCanEdit(map: GraphEditMap, userUid: string, userRole: UserRole): void {
        if (userRole === UserRole.ADMIN) return;
        if (userRole === UserRole.TEACHER) {
            if (!map.ownerUid || map.ownerUid === userUid) return;
        }
        throw new ForbiddenException('Недостатньо прав для редагування цієї карти');
    }

    /** groupId з payload або з теми; undefined = не змінювати (partial update) */
    private resolveNodeGroupIdForSave(
        nodeDto: BulkNodeDto,
        topic: Topic | null,
    ): string | null | undefined {
        if (nodeDto.groupId !== undefined) {
            return nodeDto.groupId;
        }
        if (nodeDto.topicId !== undefined && nodeDto.topicId != null && topic) {
            return topic.groupId ?? null;
        }
        return undefined;
    }

    private async createTopicForNodeInTransaction(
        queryRunner: QueryRunner,
        title: string,
        groupId: string,
    ): Promise<Topic> {
        const trimmedTitle = title.trim() || 'Новий вузол';

        const maxOrder = await queryRunner.manager
            .createQueryBuilder(Topic, 't')
            .select('MAX(t.orderInGroup)', 'maxOrder')
            .where('t.groupId = :groupId', { groupId })
            .getRawOne<{ maxOrder: string | null }>();

        const maxGlobal = await queryRunner.manager
            .createQueryBuilder(Topic, 't')
            .select('MAX(t.globalOrder)', 'maxGlobal')
            .getRawOne<{ maxGlobal: string | null }>();

        return queryRunner.manager.save(
            queryRunner.manager.create(Topic, {
                title: trimmedTitle,
                description: trimmedTitle,
                groupId,
                orderInGroup: (Number(maxOrder?.maxOrder) || 0) + 1,
                globalOrder: (Number(maxGlobal?.maxGlobal) || 0) + 1,
            }),
        );
    }
}

function mimeFromUrl(url: string): string {
    const legacyName = filenameFromPublicUrl(url);
    if (legacyName) return mimeFromFilename(legacyName);
    const pathname = url.split('?')[0] ?? '';
    return mimeFromFilename(pathname);
}

function mimeFromFilename(filename: string): string {
    const ext = extname(filename).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.webp') return 'image/webp';
    return 'image/jpeg';
}

function extFromMime(mime?: string | null): string | null {
    if (!mime) return null;
    if (mime.includes('png')) return '.png';
    if (mime.includes('gif')) return '.gif';
    if (mime.includes('webp')) return '.webp';
    if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
    return null;
}
