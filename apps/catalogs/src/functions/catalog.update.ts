import Datastore = require("@google-cloud/datastore");
import {CommitResult} from "@google-cloud/datastore/request";
import {DatastorePayload} from "@google-cloud/datastore/entity";

import {fromTaskEither} from "@ignition/nomad";
import {
    buildCatalog,
    CatalogBuildError,
    CatalogOptionsError,
    findOptions as findOptionsInner,
    Options,
} from "@ignition/catalogs";

import {tryCatch} from "fp-ts/lib/TaskEither";

import {
    buildCatalogEntity,
    CatalogAssembly,
    CatalogEntity,
    fromDatastoreError,
    SaveCatalogError
} from "./catalog.entity";
import {CatalogsResult, fromReader} from "../infrastructure/result";
import {timed} from "../infrastructure/effects";

export type UpdateCatalogError =
    SaveCatalogError
    | CatalogBuildError
    | CatalogOptionsError

export type UpdateCatalogResponse = {
    readonly projectId: string;
    readonly catalogId: string;
    readonly options: Options;
}

type ProjectId = string;
type CatalogId = string;

export function updateCatalog(
    projectId: ProjectId,
    catalogId: CatalogId,
    assembly: CatalogAssembly,
    timestamp: Date
): CatalogsResult<UpdateCatalogError, UpdateCatalogResponse> {
    return buildCatalog(assembly.families, assembly.exclusions, assembly.inclusions)
        .toNomadRTE<Datastore>()
        .mapLeft((err): UpdateCatalogError => err)
        .chain(catalogState =>
            fromReader<UpdateCatalogError, DatastorePayload<CatalogEntity>>(
                buildCatalogEntity(projectId, catalogId, assembly, catalogState.token, timestamp)
            )
                .chain(saveCatalogEntity)
                .map(() => catalogState)
        )
        .chain(catalogState => findOptionsInner(catalogState).toNomadRTE<Datastore>())
        .map(([options, _]) => ({projectId: projectId, catalogId: catalogId, options: options}));
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
