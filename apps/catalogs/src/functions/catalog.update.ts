import Datastore = require("@google-cloud/datastore");
import {CommitResult} from "@google-cloud/datastore/request";
import {DatastorePayload} from "@google-cloud/datastore/entity";

import {fromLeft, fromTaskEither} from "@ignition/nomad";
import {
    buildCatalog,
    findOptions as findOptionsInner,
    IgnitionBuildCatalogError,
    IgnitionOptionsError,
    Options,
} from "@ignition/catalogs";

import {tryCatch} from "fp-ts/lib/TaskEither";

import {buildCatalogEntity, CatalogEntity, CatalogRules, fromDatastoreError, SaveCatalogError} from "./catalog.entity";
import {CatalogsResult, fromReader} from "../infrastructure/result";
import {timed} from "../infrastructure/effects";

export type UpdateCatalogError =
    SaveCatalogError
    | { type: "MissingFamilies" }
    | IgnitionBuildCatalogError
    | IgnitionOptionsError

export type UpdateCatalogResponse = {
    readonly id: string;
    readonly options: Options;
    readonly token: string;
}

export function updateCatalog(projectId: string, rules: CatalogRules, timestamp: Date): CatalogsResult<UpdateCatalogError, UpdateCatalogResponse> {
    if (isEmptyObject(rules.families)) return fromLeft({type: "MissingFamilies"} as UpdateCatalogError);

    return buildCatalog(rules.families, rules.exclusions, rules.inclusions)
        .toNomadRTE<Datastore>()
        .mapLeft((err): UpdateCatalogError => err)
        .chain(catalog => fromReader<UpdateCatalogError, DatastorePayload<CatalogEntity>>(buildCatalogEntity(projectId, rules.id, catalog, timestamp))
            .chain(saveCatalogEntity)
            .map(() => catalog)
        )
        .chain(catalogToken => findOptionsInner(catalogToken).toNomadRTE<Datastore>())
        .map(([options, token]) => ({id: rules.id, options: options, token: token}));
}

function saveCatalogEntity(
    entity: DatastorePayload<CatalogEntity>
): CatalogsResult<SaveCatalogError, CommitResult> {
    return timed("update_catalog", {}, (datastore: Datastore) =>
        fromTaskEither(tryCatch(
            () => datastore.upsert(entity),
            (err: any) => fromDatastoreError(err, entity.data as CatalogEntity)
        ))
    );
}

function isEmptyObject(obj: object): boolean {
    return Object.keys(obj).length === 0;
}
