import {ReaderTaskEither} from "fp-ts/lib/ReaderTaskEither";
import {tryCatch} from "fp-ts/lib/TaskEither";
import {CatalogsEffect, Environment} from "./index";
import {Timed} from "./timing";

export type Interval = {
    readonly startTime?: { seconds: number },
    readonly endTime: { seconds: number }
}

export type DataPoint = {
    readonly interval: Interval
    readonly value: { doubleValue: string }
}

export function DataPoint(value: string, nowMs: number = Date.now()): DataPoint {
    return {
        interval: {
            endTime: {
                seconds: nowMs / 1000,
            },
        },
        value: {
            doubleValue: value,
        },
    };
}

export type MetricDefinition = { type: string, labels: any }

export function MetricDefinition(type: string, labels: any): MetricDefinition {
    return {
        type: `custom.googleapis.com/ignition/catalogs/${type}`,
        labels,
    };
}

export type GenericTaskResourceDefinition = {
    type: "generic_task",
    labels: { project_id: string, location: string, namespace: string, job: string, task_id: string }
}

export function GenericTaskResourceDefinition(project_id: string, location: string, namespace: string, job: string, task_id: string): GenericTaskResourceDefinition {
    return {
        type: "generic_task",
        labels: {project_id, location, namespace, job, task_id}
    };
}

export type GlobalResourceDefinition = {
    type: "global",
    labels: { project_id: string }
}

export function GlobalResourceDefinition(project_id: string): GlobalResourceDefinition {
    return {
        type: "global",
        labels: {project_id}
    };
}

export type ResourceDefinition =
    GenericTaskResourceDefinition
    | GlobalResourceDefinition

export type TimeSeriesData = {
    readonly metric: MetricDefinition
    readonly resource: ResourceDefinition
    readonly points: DataPoint[]
}

export type CreateTimeSeriesRequest = {
    readonly name: string
    readonly timeSeries: TimeSeriesData[]
}

export type MetricServiceClient = {
    createTimeSeries(request: CreateTimeSeriesRequest): Promise<void>;
    projectPath(projectId: string): string;
}

export type MetricServiceContext = [MetricServiceClient, Environment];

function toTimeSeries(env: Environment, nowMs: number = Date.now()): (effect: Timed) => TimeSeriesData {
    return effect => ({
        metric: MetricDefinition(effect.name, effect.details),
        // resource: GenericTaskResourceDefinition(env.projectId, env.location, env.namespace, effect.name, effect.id),
        resource: GlobalResourceDefinition(env.projectId),
        points: [DataPoint(`${effect.timeMs}`, nowMs)],
    });
}

export function reportMetrics(effects: ReadonlyArray<CatalogsEffect>, nowMs: number = Date.now()): ReaderTaskEither<MetricServiceContext, string, void> {
    return new ReaderTaskEither(([client, env]) => {
        const request: CreateTimeSeriesRequest = {
            name: client.projectPath(env.projectId),
            timeSeries: effects.map(toTimeSeries(env, nowMs))
        };

        return tryCatch(
            () => client.createTimeSeries(request),
            err => `${err}`
        );
    });
}
