// @ts-ignore
import {CatalogManagerClient} from "../generated/catalogs_grpc_pb";
import * as grpc from "grpc";
import {CatalogOptions, ItemOption, RetrieveCatalogOptionsRequest} from "../generated/catalogs_pb";
import {buildRequest} from "./grpc.helpers";

// gRPC client calls

function createComputerCatalog(client: CatalogManagerClient, projectId: string, catalogId: string): Promise<CatalogOptions> {
    const intelCpus = [
        "cpu:intel-i7-6700k",
        "cpu:intel-i7-3770k",
        "cpu:intel-i7-4790k",
        "cpu:intel-i5-8600k",
        "cpu:intel-i5-3570k"
    ];
    const amdCpus = [
        "cpu:amd-ryzen-7-2700x",
        "cpu:amd-ryzen-5-1600",
        "cpu:amd-ryzen-5-1600x",
        "cpu:amd-ryzen-5-2600"
    ];

    const intelGpus = [
        "gpu:gigabyte-geforce-rtx-2070",
        "gpu:evga-geforce-gtx-1070i",
        "gpu:msi-geforce-gtx-1060",
    ];
    const amdGpus = [
        "gpu:msi-rx-580-8gb-oc",
        "gpu:msi-rx-570-8gb",
        "gpu:xfx-570-8gb",
    ];

    const cpuFamily = ({
        familyId: "cpu",
        itemsList: [
            ...intelCpus,
            ...amdCpus,
        ]
    });
    const motherboardFamily = {
        familyId: "motherboard",
        itemsList: [
            "mb:msi-b350",
            "mb:msi-z390-a-pro",
            "mb:asus-strix-b350-f",
            "mb:asus-prime-z370-a",
        ]
    };
    const ramFamily = {
        familyId: "ram",
        itemsList: [
            "ram:ripjaws-v-8gb",
            "ram:ripjaws-v-16gb",
            "ram:ripjaws-v-32gb",
            "ram:corsair-vengance-4gb",
            "ram:corsair-vengance-8gb",
            "ram:corsair-vengance-16gb",
        ]
    };
    const gpuFamily = {
        familyId: "gpu",
        itemsList: [
            ...intelGpus,
            ...amdGpus
        ]
    };
    const storageFamily = {
        familyId: "storage",
        itemsList: [
            "storage:wd-hdd-1tb",
            "storage:wd-hdd-2tb",
            "storage:wd-hdd-4tb",
            "storage:wd-ssd-1tb",
            "storage:kingston-hdd-2tb",
            "storage:kingston-hdd-4tb",
            "storage:kingston-ssd-1tb",
            "storage:kingston-ssd-2tb",
        ]
    };
    const powerFamily = {
        familyId: "power",
        itemsList: [
            "ps:evga-750w",
            "ps:corsair-550w",
        ]
    };

    const amdMotherboard1 = {
        selectedItem: "mb:msi-b350",
        exclusionsList: [...intelCpus]
    };
    const amdMotherboard2 = {
        selectedItem: "mb:asus-strix-b350-f",
        exclusionsList: [...intelCpus]
    };
    const intelMotherboard1 = {
        selectedItem: "mb:msi-z390-a-pro",
        exclusionsList: [...amdCpus]
    };
    const intelMotherboard2 = {
        selectedItem: "mb:asus-prime-z370-a",
        exclusionsList: [...amdCpus]
    };

    const powerHogGpu = {
        selectedItem: "gpu:gigabyte-geforce-rtx-2070",
        inclusionsList: ["ps:evga-750w"]
    };

    const createRequest = buildRequest({
        projectId: projectId,
        catalogId: catalogId,
        familiesList: [cpuFamily, motherboardFamily, ramFamily, gpuFamily, storageFamily, powerFamily],
        exclusionsList: [amdMotherboard1, amdMotherboard2, intelMotherboard1, intelMotherboard2],
        inclusionsList: [powerHogGpu],
    });

    return new Promise<CatalogOptions>((resolve, reject) => {
        console.time("createComputerCatalog");
        client.createCatalog(createRequest, (err: any, res: CatalogOptions) => {
            console.timeEnd("createComputerCatalog");
            if (err !== null) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

function retrievePartsOptions(client: CatalogManagerClient, projectId: string, catalogId: string, token: string = "", selections: string[] = []): Promise<CatalogOptions> {
    const retrieveOptionsRequest = new RetrieveCatalogOptionsRequest();
    retrieveOptionsRequest.setProjectId(projectId);
    retrieveOptionsRequest.setCatalogId(catalogId);
    retrieveOptionsRequest.setToken(token);
    retrieveOptionsRequest.setSelectionsList(selections);

    return new Promise<CatalogOptions>((resolve, reject) => {
        console.time("retrievePartsOptions");
        client.retrieveCatalogOptions(retrieveOptionsRequest, (err: any, res: any) => {
            console.timeEnd("retrievePartsOptions");
            if (err !== null) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

// Business logic

function findFirstAvailablePart(options: CatalogOptions): ItemOption.AsObject | undefined {
    let part_matrix = options.getOptionsList()
        .map(family => family.getOptionsList());

    return ([] as ItemOption[])
        .concat(...part_matrix)
        .sort(() => 0.5 - Math.random()) // Shuffle the list
        .map((item: ItemOption) => item.toObject())
        .find((item: ItemOption.AsObject) => item.itemStatus == ItemOption.Status.AVAILABLE);
}

function findComputerBuild(options: CatalogOptions): string[] {
    let part_matrix = options.getOptionsList()
        .map(family => family.getOptionsList());

    return ([] as ItemOption[])
        .concat(...part_matrix)
        .map((item: ItemOption) => item.toObject())
        .filter((item: ItemOption.AsObject) => item.itemStatus == ItemOption.Status.SELECTED || item.itemStatus == ItemOption.Status.REQUIRED)
        .map((item: ItemOption.AsObject) => item.itemId);
}

// main

async function main() {
    const projectId = "examples";
    const catalogId = "computer-parts";

    const client = new CatalogManagerClient('ignition-app.xyz:443', grpc.credentials.createSsl());

    // Start by creating the catalog, or just getting the parts if the catalog exists
    let partOptions = await createComputerCatalog(client, projectId, catalogId)
        .catch((_err: any) => retrievePartsOptions(client, projectId, catalogId));

    // Find the first available part
    let part = findFirstAvailablePart(partOptions);

    // While there is an available part...
    while (part !== undefined) {
        console.log(`So far we have: ${JSON.stringify(findComputerBuild(partOptions))}`);
        console.log(`Selecting: ${part.itemId}\n`);

        // Add the part to the build
        partOptions = await retrievePartsOptions(client, projectId, catalogId, partOptions.getToken(), [part.itemId]);

        // Find the first available part
        part = findFirstAvailablePart(partOptions);
    }

    console.log(`Here is your completed build: ${JSON.stringify(findComputerBuild(partOptions))}`);
}

main()
    .then()
    .catch();
