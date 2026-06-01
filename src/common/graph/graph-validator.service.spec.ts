import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
    GraphEdge,
    GraphNodeInput,
    GraphValidatorService,
} from './graph-validator.service';

describe('GraphValidatorService', () => {
    let service: GraphValidatorService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [GraphValidatorService],
        }).compile();

        service = module.get(GraphValidatorService);
    });

    const nodes = (
        ...items: Array<{ id: number; title: string; groupId?: string | null }>
    ): GraphNodeInput[] => items;

    const edges = (...items: Array<{ from: number; to: number }>): GraphEdge[] =>
        items;

    it('U-01: коректний DAG — valid: true, без помилок', () => {
        const result = service.validate(
            nodes(
                { id: 1, title: 'A' },
                { id: 2, title: 'B' },
                { id: 3, title: 'C' },
            ),
            edges({ from: 1, to: 2 }, { from: 2, to: 3 }),
        );

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('U-02: цикл при strictCycles: true — valid: false', () => {
        const result = service.validate(
            nodes({ id: 1, title: 'A' }, { id: 2, title: 'B' }),
            edges({ from: 1, to: 2 }, { from: 2, to: 1 }),
            { strictCycles: true },
        );

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('цикл'))).toBe(true);
        expect(result.errors.some((e) => e.includes('DAG'))).toBe(true);
    });

    it('U-03: цикл при strictCycles: false — valid: true, є попередження', () => {
        const result = service.validate(
            nodes({ id: 1, title: 'A' }, { id: 2, title: 'B' }),
            edges({ from: 1, to: 2 }, { from: 2, to: 1 }),
            { strictCycles: false },
        );

        expect(result.valid).toBe(true);
        expect(result.warnings.some((w) => w.includes('цикл'))).toBe(true);
    });

    it('U-04: петля вузла — valid: false', () => {
        const result = service.validate(
            nodes({ id: 1, title: 'A' }),
            edges({ from: 1, to: 1 }),
        );

        expect(result.valid).toBe(false);
        expect(
            result.errors.some((e) => e.includes("з'єднаний сам із собою")),
        ).toBe(true);
    });

    it('U-05: дублікат ребра — valid: false', () => {
        const result = service.validate(
            nodes({ id: 1, title: 'A' }, { id: 2, title: 'B' }),
            edges({ from: 1, to: 2 }, { from: 1, to: 2 }),
        );

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('Дублікат ребра'))).toBe(
            true,
        );
    });

    it('U-06: ребро на неіснуючий вузол — valid: false', () => {
        const result = service.validate(
            nodes({ id: 1, title: 'A' }),
            edges({ from: 1, to: 99 }),
        );

        expect(result.valid).toBe(false);
        expect(
            result.errors.some((e) => e.includes('неіснуючий вузол')),
        ).toBe(true);
    });

    it('U-07: один вузол без ребер — valid: true', () => {
        const result = service.validate(nodes({ id: 1, title: 'A' }), []);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('U-08: ізольований вузол — попередження, valid: true', () => {
        const result = service.validate(
            nodes(
                { id: 1, title: 'A' },
                { id: 2, title: 'B' },
                { id: 3, title: 'C' },
            ),
            edges({ from: 1, to: 2 }),
            { strictIsolation: false },
        );

        expect(result.valid).toBe(true);
        expect(
            result.warnings.some((w) => w.includes('ізольований')),
        ).toBe(true);
    });

    it('U-09: ізольований вузол при strictIsolation: true — valid: false', () => {
        const result = service.validate(
            nodes(
                { id: 1, title: 'A' },
                { id: 2, title: 'B' },
                { id: 3, title: 'C' },
            ),
            edges({ from: 1, to: 2 }),
            { strictIsolation: true },
        );

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('ізольований'))).toBe(
            true,
        );
    });

    it('U-10: assertValid кидає BadRequestException при циклі', () => {
        expect(() =>
            service.assertValid(
                nodes({ id: 1, title: 'A' }, { id: 2, title: 'B' }),
                edges({ from: 1, to: 2 }, { from: 2, to: 1 }),
                true,
            ),
        ).toThrow(BadRequestException);
    });

    it('U-11: групування помилок за groupId', () => {
        const result = service.validate(
            nodes(
                { id: 1, title: 'Тема 1', groupId: 'g1' },
                { id: 2, title: 'Тема 2', groupId: 'g1' },
            ),
            edges({ from: 1, to: 1 }, { from: 2, to: 2 }),
            { groupTitleById: { g1: 'Модуль 1' } },
        );

        expect(result.valid).toBe(false);
        expect(result.groups.length).toBeGreaterThan(0);
        const bucket = result.groups.find((g) => g.groupId === 'g1');
        expect(bucket?.groupTitle).toBe('Модуль 1');
        expect(bucket?.nodes.length).toBe(2);
        expect(bucket?.nodes.every((n) => n.problems.length > 0)).toBe(true);
    });
});
