import Datastore = require("@google-cloud/datastore");
import {CatalogContents, ItemStatus} from "@ignition/wasm";

import {Catalog, CreateCatalogRequest, FamilyOptions, ItemOption} from "../generated/catalogs_pb";

import {defer, Observable} from "rxjs";
import {Either} from "fp-ts/lib/Either";
import {ReaderTaskEither, readerTaskEither} from "fp-ts/lib/ReaderTaskEither";

import {
    CatalogRules,
    createCatalog as createCatalogInner,
    SaveCatalogError,
    SaveCatalogResponse
} from "./catalog.create";
import {status} from "grpc";
import {GrpcServiceError, serviceError} from "./errors.pb";

export function createCatalog(req: CreateCatalogRequest, datastore: Datastore, timestamp = new Date()): Observable<Either<GrpcServiceError, Catalog>> {
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

function toSuccessResponse(response: SaveCatalogResponse): Catalog {
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

    let grpcResponse = new Catalog();
    grpcResponse.setCatalogId(response.id);
    grpcResponse.setOptionsList(familyOptions);
    return grpcResponse;
}

function toErrorResponse(_error: SaveCatalogError): GrpcServiceError {
    console.error(_error);

    return serviceError(
        "",
        status.INTERNAL
    );
}
