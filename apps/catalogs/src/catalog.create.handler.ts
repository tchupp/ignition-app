import Datastore = require("@google-cloud/datastore");
import {CatalogContents} from "@ignition/wasm";

import {CreateCatalogRequest, CreateCatalogResponse} from "../generated/catalogs_pb";

import {defer, Observable} from "rxjs";
import {Either} from "fp-ts/lib/Either";
import {ReaderTaskEither, readerTaskEither} from "fp-ts/lib/ReaderTaskEither";

import {
    CatalogRules,
    createCatalog as createCatalogInner,
    SaveCatalogError,
    SaveCatalogResponse
} from "./catalog.create";
import {ServiceError, status} from "grpc";

export function createCatalog(req: CreateCatalogRequest, datastore: Datastore, timestamp = new Date()): Observable<Either<ServiceError, CreateCatalogResponse>> {
    return defer(() => {
        return fromRequest<[Datastore, Date]>(req)
            .chain(rules => createCatalogInner(rules))
            .bimap(toErrorResponse, toSuccessResponse)
            .run([datastore, timestamp]);
    });
}

function fromRequest<Ctx>(req: CreateCatalogRequest): ReaderTaskEither<Ctx, SaveCatalogError, CatalogRules> {
    const catalogId = req.getCatalogId();
    const families = req.getFamiliesList()
        .reduce((acc, rule) => ({...acc, [rule.getFamilyId()]: rule.getItemsList()}), {} as CatalogContents);
    const exclusions = req.getExclusionsList()
        .reduce((acc, rule) => ({...acc, [rule.getSelectedItem()]: rule.getExclusionsList()}), {} as CatalogContents);
    const inclusions = req.getInclusionsList()
        .reduce((acc, rule) => ({...acc, [rule.getSelectedItem()]: rule.getInclusionsList()}), {} as CatalogContents);

    return readerTaskEither.of<Ctx, SaveCatalogError, CatalogRules>({
        id: catalogId,
        families: families,
        exclusions: exclusions,
        inclusions: inclusions,
    });
}

function toSuccessResponse(response: SaveCatalogResponse): CreateCatalogResponse {
    let grpcResponse = new CreateCatalogResponse();
    grpcResponse.setCatalogId(response.id);
    return grpcResponse;
}

function toErrorResponse(_error: SaveCatalogError): ServiceError {
    console.error(_error);
    return {
        name: "",
        message: "",
        code: status.ABORTED
    };
}
