import Datastore = require("@google-cloud/datastore");
import {DatastorePayload} from "@google-cloud/datastore/entity";

import {fromTaskEither} from "@ignition/nomad";
import {CatalogExclusionRule, CatalogFamilies, CatalogInclusionRule, CatalogToken} from "@ignition/catalogs";

import {asks, Reader} from "fp-ts/lib/Reader";
import {fromLeft, taskEither, tryCatch} from "fp-ts/lib/TaskEither";

import {DatastoreError, DatastoreErrorCode, NativeDatastoreError} from "../infrastructure/datastore.error";
import {CatalogsResult} from "../infrastructure/result";
import {timed} from "../infrastructure/effects";

export type CatalogAssembly = {
    readonly families: CatalogFamilies;
    readonly exclusions: CatalogExclusionRule[];
    readonly inclusions: CatalogInclusionRule[];
};

export type CatalogRules = {
    readonly exclusions: CatalogExclusionRule[];
    readonly inclusions: CatalogInclusionRule[];
}

export type CatalogEntity = {
    readonly projectId: string;
    readonly catalogId: string;
    readonly families: CatalogFamilies;
    readonly rules: CatalogRules;
    readonly token: CatalogToken;
    readonly created: Date;
}

export function buildCatalogEntity(
    projectId: string,
    catalogId: string,
    assembly: CatalogAssembly,
    token: CatalogToken,
    timestamp: Date
): Reader<Datastore, DatastorePayload<CatalogEntity>> {
    return asks(datastore => ({
        key: datastore.key({path: ["Project", projectId, "Catalog", catalogId]}),
        excludeFromIndexes: ["token"],
        data: {
            projectId: projectId,
            catalogId: catalogId,
            families: assembly.families,
            rules: {
                inclusions: assembly.inclusions,
                exclusions: assembly.exclusions,
            },
            token: token,
            created: timestamp
        } as CatalogEntity
    }));
}

export type SaveCatalogError =
    DatastoreError
    | { type: "CatalogAlreadyExists", catalogId: string }

export function fromDatastoreError(err: NativeDatastoreError, entity: CatalogEntity): SaveCatalogError {
    if (err.code === DatastoreErrorCode.ALREADY_EXISTS) {
        return {type: "CatalogAlreadyExists", catalogId: entity.catalogId};
    }
    return DatastoreError(err);
}

export type FindCatalogError =
    DatastoreError
    | { type: "CatalogNotFound", catalogId: string }

export function findCatalog(projectId: string, catalogId: string): CatalogsResult<FindCatalogError, CatalogEntity> {
    const notFoundError = fromLeft<FindCatalogError, CatalogEntity>({
        type: "CatalogNotFound",
        catalogId: catalogId
    });

    return timed(`retrieve_catalog`, {catalogId: catalogId}, (datastore: Datastore) => {
            const key = datastore.key({path: ["Project", projectId, "Catalog", catalogId]});

            return fromTaskEither(
                tryCatch(() => datastore.get(key), (err: any) => err as NativeDatastoreError)
                    .mapLeft(err => DatastoreError(err) as FindCatalogError)
                    .chain(([entity]) => (entity ? taskEither.of(entity as CatalogEntity) : notFoundError))
            );
        }
    );
}