import {nomadRTE} from "@ignition/nomad";
import {CatalogFamilies} from "@ignition/catalogs";

import {status} from "grpc";

import {
    Catalog,
    CatalogExclusionsRule,
    CatalogInclusionsRule,
    Family,
    ListCatalogsRequest,
    ListCatalogsResponse
} from "../../generated/catalogs_pb";
import {listCatalogs as listCatalogsInner, ListCatalogsError} from "./catalog.list";
import {GrpcServiceError, serviceError} from "../infrastructure/errors.pb";
import {CatalogsResult} from "../infrastructure/result";
import {CatalogEntity} from "./catalog.entity";
import {defaultCatalogState} from "./catalog.state";

export function listCatalogs(req: ListCatalogsRequest): CatalogsResult<GrpcServiceError, ListCatalogsResponse> {
    return fromRequest(req)
        .chain(projectId => listCatalogsInner(projectId))
        .mapLeft(toErrorResponse)
        .map(toSuccessResponse);
}

function fromRequest(req: ListCatalogsRequest): CatalogsResult<ListCatalogsError, string> {
    return nomadRTE.of(req.getProjectId());
}

function toSuccessResponse(entities: CatalogEntity[]): ListCatalogsResponse {
    const catalogs = entities.map(entity => {
        const catalog = new Catalog();
        catalog.setProjectId(entity.projectId);
        catalog.setCatalogId(entity.catalogId);
        catalog.setCreated(entity.created.toISOString());
        catalog.setDefaultState(defaultCatalogState(entity.projectId, entity.catalogId));
        catalog.setFamiliesList(toFamiliesList(entity.families));
        catalog.setExclusionRulesList(entity.rules.exclusions.map(({conditions, exclusions}) => {
            const rule = new CatalogExclusionsRule();
            rule.setConditionsList(conditions);
            rule.setExclusionsList(exclusions);
            return rule;
        }));
        catalog.setInclusionRulesList(entity.rules.inclusions.map(({conditions, inclusions}) => {
            const rule = new CatalogInclusionsRule();
            rule.setConditionsList(conditions);
            rule.setInclusionsList(inclusions);
            return rule;
        }));
        return catalog;
    });

    const grpcResponse = new ListCatalogsResponse();
    grpcResponse.setCatalogsList(catalogs);
    return grpcResponse;
}

function toFamiliesList(families: CatalogFamilies): Array<Family> {
    return Object.keys(families)
        .map(familyId => {
            const items = families[familyId];

            const family = new Family();
            family.setFamilyId(familyId);
            family.setItemsList(items);
            return family;
        });
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
