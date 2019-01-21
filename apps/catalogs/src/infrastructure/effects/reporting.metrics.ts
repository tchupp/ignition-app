import {ReaderTaskEither} from "fp-ts/lib/ReaderTaskEither";
import {tryCatch} from "fp-ts/lib/TaskEither";
import {CatalogsEffect, Environment} from "./index";
import {Timed} from "./timing";

type Interval = {
    readonly startTime?: { seconds: number },
    readonly endTime: { seconds: number }
}

type DataPoint = {
    readonly interval: Interval
    readonly value: { doubleValue: string }
}

function DataPoint(value: string, nowMs: number = Date.now()): DataPoint {
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

type MetricDefinition = { type: string, labels: any }

function MetricDefinition(type: string, labels: any): MetricDefinition {
    return {
        type: `custom.googleapis.com/ignition/catalogs/${type}`,
        labels,
    };
}

type GenericTaskResourceDefinition = {
    type: "generic_task",
    labels: { project_id: string, location: string, namespace: string, job: string, task_id: string }
}

function GenericTaskResourceDefinition(project_id: string, location: string, namespace: string, job: string, task_id: string): GenericTaskResourceDefinition {
    return {
        type: "generic_task",
        labels: {project_id, location, namespace, job, task_id}
    };
}

type ResourceDefinition = GenericTaskResourceDefinition

type TimeSeriesData = {
    readonly metric: MetricDefinition
    readonly resource: ResourceDefinition
    readonly points: DataPoint[]
}

type CreateTimeSeriesRequest = {
    readonly name: string
    readonly timeSeries: TimeSeriesData[]
}

export type MetricServiceClient = {
    createTimeSeries(request: CreateTimeSeriesRequest): Promise<void>;
    projectPath(projectId: string): string;
}

export type MetricServiceContext = [MetricServiceClient, Environment];

function toTimeSeries({projectId, location, namespace}: Environment): (report: Timed) => TimeSeriesData {
    return report => ({
        metric: MetricDefinition(report.name, report.details),
        resource: GenericTaskResourceDefinition(projectId, location, namespace, report.name, report.id),
        points: [DataPoint(`${report.timeMs}`)],
    });
}

export function reportMetrics(effects: ReadonlyArray<CatalogsEffect>): ReaderTaskEither<MetricServiceContext, string, void> {
    return new ReaderTaskEither(([client, {projectId, location, namespace}]) => {
        const request: CreateTimeSeriesRequest = {
            name: client.projectPath(projectId),
            timeSeries: effects.map(toTimeSeries({projectId, location, namespace}))
        };

        return tryCatch(
            () => client.createTimeSeries(request),
            err => `${err}`
        );
    });
}
