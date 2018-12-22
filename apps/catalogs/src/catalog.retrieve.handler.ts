import Datastore = require("@google-cloud/datastore");
import {Item, ItemStatus} from "@ignition/wasm";
import {Catalog, FamilyOptions, ItemOption, RetrieveCatalogRequest} from "../generated/catalogs_pb";

import {Either} from "fp-ts/lib/Either";
import {fromLeft, readerTaskEither, ReaderTaskEither} from "fp-ts/lib/ReaderTaskEither";
import {status} from "grpc";
import {defer, Observable} from "rxjs";

import {
    retrieveCatalog as retrieveCatalogInner,
    RetrieveCatalogError,
    RetrieveCatalogResponse
} from "./catalog.retrieve";
import {badRequestDetail, GrpcServiceError, serviceError} from "./errors.pb";

export function retrieveCatalog(req: RetrieveCatalogRequest, datastore: Datastore): Observable<Either<GrpcServiceError, Catalog>> {
    return defer(() => {
        return fromRequest(req)
            .chain(([catalogId, selections]) => retrieveCatalogInner(catalogId, selections))
            .bimap(toErrorResponse, toSuccessResponse)
            .run(datastore);
    });
}

function fromRequest(req: RetrieveCatalogRequest): ReaderTaskEither<Datastore, RetrieveCatalogError, [string, Item[]]> {
    const selections_matrix = req.getSelectionsList()
        .map(selection => selection.split(","));
    const selections: string[] = ([] as string[]).concat(...selections_matrix);

    const catalogId = req.getCatalogId();
    if (catalogId.length === 0) {
        return fromLeft({type: "RequestMissingCatalogId", error: "No catalog id in request"} as RetrieveCatalogError);
    }

    return readerTaskEither.of([catalogId, selections] as [string, Item[]]);
}

function toSuccessResponse(response: RetrieveCatalogResponse): Catalog {
    function toItem(status: ItemStatus): ItemOption {
        const item = new ItemOption();
        switch (status.type) {
            case "Available":
                item.setItemId(status.item);
                item.setItemStatus(ItemOption.Status.AVAILABLE);
                return item;
            case "Excluded":
                item.setItemId(status.item);
                item.setItemStatus(ItemOption.Status.EXCLUDED);
                return item;
            case "Selected":
                item.setItemId(status.item);
                item.setItemStatus(ItemOption.Status.SELECTED);
                return item;
            case "Required":
                item.setItemId(status.item);
                item.setItemStatus(ItemOption.Status.REQUIRED);
                return item;
        }
    }

    function toFamilyOptions(familyId: string, statuses: ItemStatus[]): FamilyOptions {
        const items = statuses.map((status: ItemStatus) => toItem(status));

        const familyOptions = new FamilyOptions();
        familyOptions.setFamilyId(familyId);
        familyOptions.setOptionsList(items);
        return familyOptions;
    }

    const familyOptions: FamilyOptions[] =
        Object.keys(response.options)
            .map(familyId => toFamilyOptions(familyId, response.options[familyId]));

    const catalog = new Catalog();
    catalog.setCatalogId(response.id);
    catalog.setOptionsList(familyOptions);
    return catalog;
}

function toErrorResponse(error: RetrieveCatalogError): GrpcServiceError {
    console.error(error);

    switch (error.type) {
        case "RequestMissingCatalogId":
            return serviceError(
                "Missing CatalogId",
                status.INVALID_ARGUMENT,
                [
                    badRequestDetail({
                        fieldViolationsList: [{
                            field: "catalog_id",
                            description: "Catalog Id is required"
                        }]
                    })
                ]);

        case "Datastore":
            return serviceError(
                "Datastore Error",
                status.INTERNAL,
                []);

        case "CatalogNotFound":
            return serviceError(
                error.error,
                status.NOT_FOUND,
                []);

        case "Ignition": {
            return serviceError(
                error.error.error,
                status.INVALID_ARGUMENT,
                [
                    badRequestDetail({
                        fieldViolationsList: [{
                            field: "selections",
                            description: error.error.details
                        }]
                    })
                ]);
        }
    }
}
