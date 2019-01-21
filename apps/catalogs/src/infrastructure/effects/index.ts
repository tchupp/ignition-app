import {Timed} from "./timing";
import {reportMetrics} from "./reporting.metrics";
import ProcessEnv = NodeJS.ProcessEnv;

const monitoring = require("@google-cloud/monitoring");

export {timed} from "./timing";

export type Environment = { projectId: string, location: string, namespace: string };

export function Environment(env: ProcessEnv): Environment {
    const projectId = env.GCLOUD_PROJECT || "local-dev";
    const location = env.LOCATION || "local-location";
    const namespace = env.NAMESPACE || "local-namespace";

    return {projectId, location, namespace};
}

export type EffectDetails =
    {}
    // Ignition core - effect details
    | { readonly token: string }
    // Catalogs - effect details
    | { readonly catalogId: string }

export type CatalogsEffect = Timed;

const client = new monitoring.MetricServiceClient();

const never = () => {
};

export async function handleEffects(effects: ReadonlyArray<CatalogsEffect>): Promise<void[]> {
    return Promise.all([
        reportMetrics(effects)
            .run([client, Environment(process.env)])
            .then(never)
            .catch(err => console.error(err)),
    ]);
}
