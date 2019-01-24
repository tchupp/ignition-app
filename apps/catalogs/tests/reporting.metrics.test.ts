import test from "ava";

import {Timed} from "../src/infrastructure/effects/timing";
import {
    CreateTimeSeriesRequest,
    DataPoint,
    GlobalResourceDefinition,
    MetricDefinition,
    MetricServiceClient,
    reportMetrics
} from "../src/infrastructure/effects/reporting.metrics";

const nowMs = Date.now();

test("reportMetrics", async (t) => {
    const env = {projectId: "project 1", namespace: "ns 2", location: "loc 3"};
    const timed = Timed("1234", "function", {}, [900, 800]);

    let actualRequest: CreateTimeSeriesRequest = {
        name: "initial",
        timeSeries: []
    };
    const metricsClient: MetricServiceClient = {
        createTimeSeries: async (request: CreateTimeSeriesRequest): Promise<void> => {
            actualRequest = request;
        },
        projectPath(projectId: string): string {
            return projectId + " for real";
        }
    };

    await reportMetrics([timed], nowMs)
        .run([metricsClient, env]);

    t.deepEqual(actualRequest, {
        name: "project 1 for real",
        timeSeries: [{
            metric: MetricDefinition(timed.name, timed.details),
            // resource: GenericTaskResourceDefinition(env.projectId, env.location, env.namespace, timed.name, timed.id),
            resource: GlobalResourceDefinition(env.projectId),
            points: [DataPoint(`${timed.timeMs}`, nowMs)],
        }]
    });
});