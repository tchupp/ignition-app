import Datastore = require("@google-cloud/datastore");
import {Item, ItemStatus} from "@ignition/wasm";
import {Catalog, FamilyOptions, ItemOption, RetrieveCatalogRequest} from "../generated/catalogs_pb";

import {Either} from "fp-ts/lib/Either";
import {fromLeft, readerTaskEither, ReaderTaskEither} from "fp-ts/lib/ReaderTaskEither";
import {ServiceError, status} from "grpc";
import {defer, Observable} from "rxjs";

import {
    ErrorType,
    retrieveCatalog as retrieveCatalogInner,
    RetrieveCatalogError,
    RetrieveCatalogResponse
} from "./catalog.retrieve";

export function retrieveCatalog(req: RetrieveCatalogRequest, datastore: Datastore): Observable<Either<ServiceError, Catalog>> {
    return defer(() => {
        return fromRequest(req)
            .chain(([catalogId, selections]) => retrieveCatalogInner(catalogId, selections))
            .bimap(toErrorResponse, toSuccessResponse)
            .run(datastore);
    });
}

function fromRequest(req: RetrieveCatalogRequest): ReaderTaskEither<Datastore, RetrieveCatalogError, [string, Item[]]> {
    const catalogId = req.getCatalogId();
    const selections = req.getSelectionsList();

    if (catalogId.length === 0) {
        return fromLeft({type: ErrorType.NotFound, body: {error: "No catalog id in request"}});
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

function toErrorResponse(_error: RetrieveCatalogError): ServiceError {
    console.error(_error);
    return {
        name: "",
        message: "",
        code: status.ABORTED
    };
}
