import {nomadRTE} from "@ignition/nomad";

import {status} from "grpc";

import {Catalog, ListCatalogsRequest, ListCatalogsResponse} from "../../generated/catalogs_pb";
import {ListCatalogResponseItem, listCatalogs as listCatalogsInner, ListCatalogsError} from "./catalog.list";
import {GrpcServiceError, serviceError} from "../infrastructure/errors.pb";
import {CatalogsResult} from "../infrastructure/result";

export function listCatalogs(req: ListCatalogsRequest): CatalogsResult<GrpcServiceError, ListCatalogsResponse> {
    return fromRequest(req)
        .chain(projectId => listCatalogsInner(projectId))
        .mapLeft(toErrorResponse)
        .map(toSuccessResponse);
}

function fromRequest(req: ListCatalogsRequest): CatalogsResult<ListCatalogsError, string> {
    return nomadRTE.of(req.getProjectId());
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
