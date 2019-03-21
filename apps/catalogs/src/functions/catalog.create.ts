import Datastore = require("@google-cloud/datastore");
import {CommitResult} from "@google-cloud/datastore/request";
import {DatastorePayload} from "@google-cloud/datastore/entity";

import {fromTaskEither} from "@ignition/nomad";
import {
    buildCatalog,
    CatalogBuildError,
    CatalogOptionsError,
    CatalogToken,
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

export type CreateCatalogError =
    SaveCatalogError
    | CatalogBuildError
    | CatalogOptionsError

export type CreateCatalogResponse = {
    readonly id: string;
    readonly options: Options;
    readonly token: CatalogToken;
}

type ProjectId = string;
type CatalogId = string;

export function createCatalog(
    projectId: ProjectId,
    catalogId: CatalogId,
    assembly: CatalogAssembly,
    timestamp: Date
): CatalogsResult<CreateCatalogError, CreateCatalogResponse> {
    return buildCatalog(assembly.families, assembly.exclusions, assembly.inclusions)
        .toNomadRTE<Datastore>()
        .mapLeft((err): CreateCatalogError => err)
        .chain(catalogState =>
            fromReader<CreateCatalogError, DatastorePayload<CatalogEntity>>(
                buildCatalogEntity(projectId, catalogId, assembly, catalogState.token, timestamp)
            )
                .chain(saveCatalogEntity)
                .map(() => catalogState)
        )
        .chain(catalogState => findOptionsInner(catalogState).toNomadRTE<Datastore>())
        .map(([options, catalog]) => ({id: catalogId, options: options, token: catalog.token}));
}

function saveCatalogEntity(
    entity: DatastorePayload<CatalogEntity>
): CatalogsResult<SaveCatalogError, CommitResult> {
    return timed("insert_catalog", {}, (datastore: Datastore) =>
        fromTaskEither(tryCatch(
            () => datastore.insert(entity),
            (err: any) => fromDatastoreError(err, entity.data as CatalogEntity)
        ))
    );
}
