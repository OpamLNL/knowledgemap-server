import { Injectable, BadRequestException } from '@nestjs/common';

export type GraphEdge = { from: number; to: number; id?: number };

export type GraphNodeInput = {
    id: number;
    title: string;
    groupId?: string | null;
};

export type GraphValidationNodeIssue = {
    nodeId: number;
    nodeTitle: string;
    problems: string[];
};

export type GraphValidationGroupBucket = {
    groupId: string | null;
    groupTitle: string;
    nodes: GraphValidationNodeIssue[];
};

export type GraphValidationResult = {
    valid: boolean;
    errors: string[];
    warnings: string[];
    globalIssues: string[];
    groups: GraphValidationGroupBucket[];
};

export type GraphValidateOptions = {
    strictCycles?: boolean;
    strictIsolation?: boolean;
    groupTitleById?: Record<string, string>;
};

type CollectedIssue = {
    severity: 'error' | 'warning';
    message: string;
    nodeId?: number;
    isGlobal?: boolean;
};

@Injectable()
export class GraphValidatorService {
    validate(
        nodes: GraphNodeInput[],
        edges: GraphEdge[],
        options: GraphValidateOptions = {},
    ): GraphValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        const collected: CollectedIssue[] = [];
        const nodeIds = nodes.map((n) => n.id);
        const nodeIdSet = new Set(nodeIds);
        const nodeById = new Map(nodes.map((n) => [n.id, n]));

        const nodeLabel = (id: number): string => {
            const title = nodeById.get(id)?.title?.trim();
            return title ? `«${title}»` : `#${id}`;
        };

        const pushIssue = (issue: CollectedIssue) => {
            collected.push(issue);
            if (issue.severity === 'error') {
                errors.push(issue.message);
            } else {
                warnings.push(issue.message);
            }
        };

        const edgeKeys = new Set<string>();

        for (const edge of edges) {
            if (edge.from === edge.to) {
                pushIssue({
                    severity: 'error',
                    message: `Вузол ${nodeLabel(edge.from)} не може бути з'єднаний сам із собою`,
                    nodeId: edge.from,
                });
            }

            if (!nodeIdSet.has(edge.from)) {
                pushIssue({
                    severity: 'error',
                    message: `Ребро посилається на неіснуючий вузол ${nodeLabel(edge.from)}`,
                    nodeId: edge.from,
                });
            }
            if (!nodeIdSet.has(edge.to)) {
                pushIssue({
                    severity: 'error',
                    message: `Ребро посилається на неіснуючий вузол ${nodeLabel(edge.to)}`,
                    nodeId: edge.to,
                });
            }

            const key = `${edge.from}->${edge.to}`;
            if (edgeKeys.has(key)) {
                pushIssue({
                    severity: 'error',
                    message: `Дублікат ребра: ${nodeLabel(edge.from)} → ${nodeLabel(edge.to)}`,
                    nodeId: edge.from,
                });
            }
            edgeKeys.add(key);
        }

        const edgesForStructure = edges.filter(
            (e) => nodeIdSet.has(e.from) && nodeIdSet.has(e.to),
        );

        const cycleNodeIds = this.findCycleNodeIds(nodeIds, edgesForStructure);
        if (cycleNodeIds.size > 0) {
            const cycleMsg = 'Граф містить цикл — карта не є DAG';
            if (options.strictCycles) {
                pushIssue({ severity: 'error', message: cycleMsg, isGlobal: true });
                for (const id of cycleNodeIds) {
                    pushIssue({
                        severity: 'error',
                        message: `${nodeLabel(id)} — участь у циклі`,
                        nodeId: id,
                    });
                }
            } else {
                warnings.push(`${cycleMsg}; збереження дозволено`);
                collected.push({
                    severity: 'warning',
                    message: `${cycleMsg}; збереження дозволено`,
                    isGlobal: true,
                });
            }
        }

        const connected = new Set<number>();
        for (const e of edgesForStructure) {
            connected.add(e.from);
            connected.add(e.to);
        }
        for (const node of nodes) {
            if (!connected.has(node.id) && nodes.length > 1) {
                const msg = `${nodeLabel(node.id)} не має жодного зв'язку (ізольований)`;
                if (options.strictIsolation) {
                    pushIssue({ severity: 'error', message: msg, nodeId: node.id });
                } else {
                    pushIssue({ severity: 'warning', message: msg, nodeId: node.id });
                }
            }
        }

        const groups = this.buildGroupBuckets(nodes, collected, options.groupTitleById ?? {});

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            globalIssues: collected
                .filter((i) => i.isGlobal)
                .map((i) => i.message),
            groups,
        };
    }

    assertValid(nodes: GraphNodeInput[], edges: GraphEdge[], strictCycles = true): void {
        const result = this.validate(nodes, edges, { strictCycles });
        if (!result.valid) {
            throw new BadRequestException({
                message: 'Граф не пройшов валідацію',
                errors: result.errors,
            });
        }
    }

    private buildGroupBuckets(
        nodes: GraphNodeInput[],
        issues: CollectedIssue[],
        groupTitleById: Record<string, string>,
    ): GraphValidationGroupBucket[] {
        const nodeIssues = issues.filter((i) => i.nodeId != null && !i.isGlobal);
        if (nodeIssues.length === 0) return [];

        const bucketMap = new Map<string, Map<number, GraphValidationNodeIssue>>();

        const ensureBucket = (groupId: string | null) => {
            const key = groupId ?? '__none__';
            if (!bucketMap.has(key)) {
                bucketMap.set(key, new Map());
            }
            return bucketMap.get(key)!;
        };

        for (const issue of nodeIssues) {
            const nodeId = issue.nodeId!;
            const node = nodes.find((n) => n.id === nodeId);
            const groupId = node?.groupId ?? null;
            const bucket = ensureBucket(groupId);
            const title = node?.title?.trim() || `#${nodeId}`;
            const existing = bucket.get(nodeId);
            if (existing) {
                if (!existing.problems.includes(issue.message)) {
                    existing.problems.push(issue.message);
                }
            } else {
                bucket.set(nodeId, { nodeId, nodeTitle: title, problems: [issue.message] });
            }
        }

        const buckets: GraphValidationGroupBucket[] = [];
        for (const [key, nodeMap] of bucketMap) {
            const groupId = key === '__none__' ? null : key;
            const groupTitle =
                groupId != null
                    ? (groupTitleById[groupId]?.trim() || groupId)
                    : 'Без групи';
            buckets.push({
                groupId,
                groupTitle,
                nodes: [...nodeMap.values()].sort((a, b) =>
                    a.nodeTitle.localeCompare(b.nodeTitle, 'uk'),
                ),
            });
        }

        buckets.sort((a, b) => a.groupTitle.localeCompare(b.groupTitle, 'uk'));
        return buckets;
    }

    private findCycleNodeIds(nodeIds: number[], edges: GraphEdge[]): Set<number> {
        const inCycle = new Set<number>();
        const adj = new Map<number, number[]>();
        for (const id of nodeIds) adj.set(id, []);
        for (const e of edges) {
            if (adj.has(e.from)) adj.get(e.from)!.push(e.to);
        }

        const visited = new Set<number>();
        const stack: number[] = [];
        const inStack = new Set<number>();

        const dfs = (node: number): void => {
            visited.add(node);
            stack.push(node);
            inStack.add(node);

            for (const next of adj.get(node) ?? []) {
                if (!visited.has(next)) {
                    dfs(next);
                } else if (inStack.has(next)) {
                    const startIdx = stack.indexOf(next);
                    if (startIdx >= 0) {
                        for (let i = startIdx; i < stack.length; i++) {
                            inCycle.add(stack[i]);
                        }
                    }
                }
            }

            stack.pop();
            inStack.delete(node);
        };

        for (const id of nodeIds) {
            if (!visited.has(id)) dfs(id);
        }

        return inCycle;
    }
}
