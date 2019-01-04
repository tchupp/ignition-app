// @ts-ignore
import {CatalogManagerClient} from "../generated/catalogs_grpc_pb";
import * as grpc from "grpc";
// @ts-ignore
import {
    CatalogOptions,
    CreateCatalogRequest,
    Exclusion,
    Family,
    Inclusion,
    ItemOption,
    RetrieveCatalogOptionsRequest
} from "../generated/catalogs_pb";

// Builder functions for gRPC requests

function buildFamily(f: Family.AsObject): Family {
    const family = new Family();
    family.setFamilyId(f.familyId);
    family.setItemsList(f.itemsList);

    return family;
}

function buildExclusion(e: Exclusion.AsObject): Exclusion {
    const exclusion = new Exclusion();
    exclusion.setSelectedItem(e.selectedItem);
    exclusion.setExclusionsList(e.exclusionsList);

    return exclusion;
}

function buildInclusion(e: Inclusion.AsObject): Inclusion {
    const inclusion = new Inclusion();
    inclusion.setSelectedItem(e.selectedItem);
    inclusion.setInclusionsList(e.inclusionsList);

    return inclusion;
}

function buildRequest(r: CreateCatalogRequest.AsObject) {
    const req = new CreateCatalogRequest();
    req.setProjectId(r.projectId);
    req.setCatalogId(r.catalogId);
    req.setFamiliesList(r.familiesList.map(buildFamily));
    req.setInclusionsList(r.inclusionsList.map(buildInclusion));
    req.setExclusionsList(r.exclusionsList.map(buildExclusion));

    return req;
}

// gRPC client calls

function createGranolaCatalog(client: CatalogManagerClient, projectId: string, catalogId: string): Promise<CatalogOptions> {
    const oatsFamily = ({
        familyId: "oats",
        itemsList: [
            "3-cups:old-fashioned-oats"
        ]
    });
    const nutsFamily = {
        familyId: "chopped-nuts",
        itemsList: [
            "2-cups:almonds",
            "2-cups:cashews",
            "2-cups:walnuts",
            "2-cups:peanuts",
            "split-2-cups:peanuts-cashews",
        ]
    };
    const additivesFamily = {
        familyId: "additives",
        itemsList: [
            "half-cup:coconut-flakes",
            "half-cup:chia-seeds",
            "half-cup:chopped-apples",
        ]
    };
    const sweetenerFamily = {
        familyId: "sweeteners",
        itemsList: [
            "half-cup:maple-syrup",
            "half-cup:agave",
            "half-cup:honey",
            "half-cup:molasses",
            "half-cup:brown-sugar",
        ]
    };

    const noCoconutPeanut = {
        selectedItem: "half-cup:coconut-flakes",
        exclusionsList: ["2-cups:peanuts", "split-2-cups:peanuts-cashews"]
    };
    const honeyWalnut = {
        selectedItem: "2-cups:walnuts",
        inclusionsList: ["half-cup:honey"]
    };

    const createRequest = buildRequest({
        projectId: projectId,
        catalogId: catalogId,
        familiesList: [oatsFamily, nutsFamily, additivesFamily, sweetenerFamily],
        exclusionsList: [noCoconutPeanut],
        inclusionsList: [honeyWalnut],
    });

    return new Promise<CatalogOptions>((resolve, reject) => {
        client.createCatalog(createRequest, (err: any, res: CatalogOptions) => {
            if (err !== null) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

function retrieveGranolaOptions(client: CatalogManagerClient, projectId: string, catalogId: string, token: string = "", selections: string[] = []): Promise<CatalogOptions> {
    const retrieveOptionsRequest = new RetrieveCatalogOptionsRequest();
    retrieveOptionsRequest.setProjectId(projectId);
    retrieveOptionsRequest.setCatalogId(catalogId);
    retrieveOptionsRequest.setToken(token);
    retrieveOptionsRequest.setSelectionsList(selections);

    return new Promise<CatalogOptions>((resolve, reject) => {
        client.retrieveCatalogOptions(retrieveOptionsRequest, (err: any, res: any) => {
            if (err !== null) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

// Business logic

function findFirstAvailableOption(options: CatalogOptions): ItemOption.AsObject | undefined {
    let item_matrix = options.getOptionsList()
        .map(family => family.getOptionsList());

    return ([] as ItemOption[])
        .concat(...item_matrix)
        .map((item: ItemOption) => item.toObject())
        .find((item: ItemOption.AsObject) => item.itemStatus == ItemOption.Status.AVAILABLE);
}

function findRecipe(options: CatalogOptions): string[] {
    let item_matrix = options.getOptionsList()
        .map(family => family.getOptionsList());

    return ([] as ItemOption[])
        .concat(...item_matrix)
        .map((item: ItemOption) => item.toObject())
        .filter((item: ItemOption.AsObject) => item.itemStatus == ItemOption.Status.SELECTED || item.itemStatus == ItemOption.Status.REQUIRED)
        .map((item: ItemOption.AsObject) => item.itemId);
}

// main

async function main() {
    const projectId = "YOUR_PROJECT_ID";
    const catalogId = "granola-recipes";

    const client = new CatalogManagerClient('ignition-app.xyz:443', grpc.credentials.createSsl());

    // Start by creating the catalog, or just getting the options if the catalog exists
    let options = await createGranolaCatalog(client, projectId, catalogId)
        .catch((_err: any) => retrieveGranolaOptions(client, projectId, catalogId));

    // Find the first available option
    let item = findFirstAvailableOption(options);

    // While there is an available item...
    while (item !== undefined) {
        console.log(`So far we have: ${JSON.stringify(findRecipe(options))}`);
        console.log(`Selecting: ${item.itemId}\n`);

        // Add the item to the recipe
        options = await retrieveGranolaOptions(client, projectId, catalogId, options.getToken(), [item.itemId]);

        // Find the first available option
        item = findFirstAvailableOption(options);
    }

    console.log(`Here is your granola recipe: ${JSON.stringify(findRecipe(options))}`);
}

main()
    .then()
    .catch();
