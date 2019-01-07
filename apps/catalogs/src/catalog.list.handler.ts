import Datastore = require("@google-cloud/datastore");
import {readerTaskEither, ReaderTaskEither} from "fp-ts/lib/ReaderTaskEither";

import {ListCatalogResponseItem, listCatalogs as listCatalogsInner, ListCatalogsError} from "./catalog.list";
import {Catalog, ListCatalogsRequest, ListCatalogsResponse} from "../generated/catalogs_pb";
import {GrpcServiceError, serviceError} from "./errors.pb";
import {status} from "grpc";

export function listCatalogs(req: ListCatalogsRequest): ReaderTaskEither<Datastore, GrpcServiceError, ListCatalogsResponse> {
    return fromRequest<Datastore>(req)
        .chain(() => listCatalogsInner())
        .bimap(toErrorResponse, toSuccessResponse);
}

function fromRequest<Ctx>(_req: ListCatalogsRequest): ReaderTaskEither<Ctx, ListCatalogsError, any[]> {
    return readerTaskEither.of([]);
}

function toSuccessResponse(items: ListCatalogResponseItem[]): ListCatalogsResponse {
    const catalogs = items.map(cat => {
        const catalog = new Catalog();
        catalog.setCatalogId(cat.id);
        catalog.setToken(cat.token);
        catalog.setCreated(cat.created.toISOString());
        return catalog;
    });

    const grpcResponse = new ListCatalogsResponse();
    grpcResponse.setCatalogsList(catalogs);
    return grpcResponse;
}

function toErrorResponse(error: ListCatalogsError): GrpcServiceError {
    switch (error.type) {
        case "Datastore":
            return serviceError(
                "Datastore Error",
                status.INTERNAL,
                []);
    }

    return serviceError(
        "Unknown Error",
        status.UNKNOWN,
        []);
}
