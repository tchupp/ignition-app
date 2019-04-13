import {nomadRTE} from "@ignition/nomad";
import {CatalogFamilies} from "@ignition/catalogs";

import {status} from "grpc";

import {retrieveCatalog as retrieveCatalogInner, RetrieveCatalogError,} from "./catalog.retrieve";
import {
    Catalog,
    CatalogExclusionsRule,
    CatalogInclusionsRule,
    Family,
    RetrieveCatalogRequest
} from "../../generated/catalogs_pb";
import {badRequestDetail, GrpcServiceError, serviceError} from "../infrastructure/errors.pb";
import {CatalogsResult} from "../infrastructure/result";
import {CatalogEntity} from "./catalog.entity";
import {defaultCatalogState} from "./catalog.state";

export function retrieveCatalog(req: RetrieveCatalogRequest): CatalogsResult<GrpcServiceError, Catalog> {
    return fromRequest(req)
        .chain(([projectId, catalogId]) => retrieveCatalogInner(projectId, catalogId))
        .mapLeft(toErrorResponse)
        .map(toSuccessResponse);
}

function fromRequest(req: RetrieveCatalogRequest): CatalogsResult<RetrieveCatalogError, [string, string]> {
    const projectId = req.getProjectId();
    const catalogId = req.getCatalogId();

    return nomadRTE.of([projectId, catalogId] as [string, string]);
}

function toSuccessResponse(entity: CatalogEntity): Catalog {
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

function toErrorResponse(error: RetrieveCatalogError): GrpcServiceError {
    switch (error.type) {
        case "Datastore":
            return serviceError(
                "Datastore Error",
                status.INTERNAL,
                []);

        case "MissingProjectId":
            return serviceError(
                "Missing ProjectId",
                status.INVALID_ARGUMENT,
                [
                    badRequestDetail({
                        fieldViolationsList: [{
                            field: "project_id",
                            description: "Project Id is required"
                        }]
                    })
                ]);

        case "MissingCatalogId":
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

        case "CatalogNotFound":
            return serviceError(
                `No catalog found with id '${error.catalogId}'`,
                status.NOT_FOUND);

    }

    return serviceError(
        "Unknown Error",
        status.UNKNOWN,
        []);
}
