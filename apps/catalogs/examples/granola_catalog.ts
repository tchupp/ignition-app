// @ts-ignore
import {CatalogManagerClient} from "../generated/catalogs_grpc_pb";
import * as grpc from "grpc";
import {CatalogOptions, ItemOption, RetrieveCatalogOptionsRequest} from "../generated/catalogs_pb";
import {buildRequest} from "./grpc.helpers";

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

function retrieveGranolaIngredientsOptions(client: CatalogManagerClient, projectId: string, catalogId: string, token: string = "", selections: string[] = []): Promise<CatalogOptions> {
    const retrieveOptionsRequest = new RetrieveCatalogOptionsRequest();
    retrieveOptionsRequest.setProjectId(projectId);
    retrieveOptionsRequest.setCatalogId(catalogId);
    retrieveOptionsRequest.setToken(token);
    retrieveOptionsRequest.setSelectionsList(selections);

    return new Promise<CatalogOptions>((resolve, reject) => {
        console.time("Request");
        client.retrieveCatalogOptions(retrieveOptionsRequest, (err: any, res: any) => {
            console.timeEnd("Request");
            if (err !== null) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

// Business logic

function findFirstAvailableIngredient(options: CatalogOptions): ItemOption.AsObject | undefined {
    let ingredient_matrix = options.getOptionsList()
        .map(family => family.getOptionsList());

    return ([] as ItemOption[])
        .concat(...ingredient_matrix)
        .sort(() => 0.5 - Math.random()) // Shuffle the list
        .map((item: ItemOption) => item.toObject())
        .find((item: ItemOption.AsObject) => item.itemStatus == ItemOption.Status.AVAILABLE);
}

function findRecipe(options: CatalogOptions): string[] {
    let ingredient_matrix = options.getOptionsList()
        .map(family => family.getOptionsList());

    return ([] as ItemOption[])
        .concat(...ingredient_matrix)
        .map((item: ItemOption) => item.toObject())
        .filter((item: ItemOption.AsObject) => item.itemStatus == ItemOption.Status.SELECTED || item.itemStatus == ItemOption.Status.REQUIRED)
        .map((item: ItemOption.AsObject) => item.itemId);
}

// main

async function main() {
    const projectId = "examples";
    const catalogId = "granola-recipes";

    const client = new CatalogManagerClient('ignition-app.xyz:443', grpc.credentials.createSsl());

    // Start by creating the catalog, or just getting the options if the catalog exists
    let ingredientsOptions = await createGranolaCatalog(client, projectId, catalogId)
        .catch((_err: any) => retrieveGranolaIngredientsOptions(client, projectId, catalogId));

    // Find the first available ingredient
    let ingredient = findFirstAvailableIngredient(ingredientsOptions);

    // While there is an available ingredient...
    while (ingredient !== undefined) {
        console.log(`So far we have: ${JSON.stringify(findRecipe(ingredientsOptions))}`);
        console.log(`Selecting: ${ingredient.itemId}\n`);

        // Add the ingredient to the recipe
        ingredientsOptions = await retrieveGranolaIngredientsOptions(client, projectId, catalogId, ingredientsOptions.getToken(), [ingredient.itemId]);

        // Find the first available ingredient
        ingredient = findFirstAvailableIngredient(ingredientsOptions);
    }

    console.log(`Here is your completed granola recipe: ${JSON.stringify(findRecipe(ingredientsOptions))}`);
}

main()
    .then()
    .catch();
