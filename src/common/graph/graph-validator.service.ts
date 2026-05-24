import { Injectable, BadRequestException } from '@nestjs/common';

export type GraphEdge = { from: number; to: number; id?: number };
export type GraphValidationResult = {
    valid: boolean;
    errors: string[];
    warnings: string[];
};

@Injectable()
export class GraphValidatorService {
    validate(
        nodeIds: number[],
        edges: GraphEdge[],
    ): GraphValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        const nodeIdSet = new Set(nodeIds);

        const edgeKeys = new Set<string>();

        for (const edge of edges) {
            if (edge.from === edge.to) {
                errors.push(`Self-loop: вузол ${edge.from} не може бути з'єднаний сам із собою`);
            }

            if (!nodeIdSet.has(edge.from)) {
                errors.push(`Ребро посилається на неіснуючий вузол from=${edge.from}`);
            }
            if (!nodeIdSet.has(edge.to)) {
                errors.push(`Ребро посилається на неіснуючий вузол to=${edge.to}`);
            }

            const key = `${edge.from}->${edge.to}`;
            if (edgeKeys.has(key)) {
                errors.push(`Дублікат ребра: ${edge.from} → ${edge.to}`);
            }
            edgeKeys.add(key);
        }

        if (this.hasCycle(nodeIds, edges)) {
            errors.push('Граф містить цикл — карта знань має бути ациклічним (DAG)');
        }

        const connected = new Set<number>();
        for (const e of edges) {
            connected.add(e.from);
            connected.add(e.to);
        }
        for (const id of nodeIds) {
            if (!connected.has(id) && nodeIds.length > 1) {
                warnings.push(`Вузол ${id} не має жодного зв'язку (ізольований)`);
            }
        }

        return { valid: errors.length === 0, errors, warnings };
    }

    assertValid(nodeIds: number[], edges: GraphEdge[]): void {
        const result = this.validate(nodeIds, edges);
        if (!result.valid) {
            throw new BadRequestException({
                message: 'Граф не пройшов валідацію',
                errors: result.errors,
            });
        }
    }

    private hasCycle(nodeIds: number[], edges: GraphEdge[]): boolean {
        const adj = new Map<number, number[]>();
        for (const id of nodeIds) adj.set(id, []);
        for (const e of edges) {
            if (adj.has(e.from)) adj.get(e.from)!.push(e.to);
        }

        const visited = new Set<number>();
        const inStack = new Set<number>();

        const dfs = (node: number): boolean => {
            visited.add(node);
            inStack.add(node);
            for (const next of adj.get(node) ?? []) {
                if (!visited.has(next)) {
                    if (dfs(next)) return true;
                } else if (inStack.has(next)) {
                    return true;
                }
            }
            inStack.delete(node);
            return false;
        };

        for (const id of nodeIds) {
            if (!visited.has(id) && dfs(id)) return true;
        }
        return false;
    }
}
