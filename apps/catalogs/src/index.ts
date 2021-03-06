// initialize StackDriver trace
require('@google-cloud/trace-agent').start();

// hack to include source-map-support in runtime
// noinspection TsLint
require("source-map-support").install();

import Datastore = require("@google-cloud/datastore");
import * as grpc from "grpc";
// @ts-ignore
import {CatalogManagerService} from "../generated/catalogs_grpc_pb";
import * as messages from "../generated/catalogs_pb";

import {Either} from "fp-ts/lib/Either";

import {retrieveCatalogOptions as retrieveCatalogOptionsInner} from "./functions/catalog.retrieve.options.handler";
import {retrieveCatalog as retrieveCatalogInner} from "./functions/catalog.retrieve.handler";
import {createCatalog as createCatalogInner} from "./functions/catalog.create.handler";
import {updateCatalog as updateCatalogInner} from "./functions/catalog.update.handler";
import {listCatalogs as listCatalogsInner} from "./functions/catalog.list.handler";
import {GrpcServiceError, serviceError} from "./infrastructure/errors.pb";
import {handleEffects} from "./infrastructure/effects";

const datastore = new Datastore();

function handleResult<Res>(callback: grpc.sendUnaryData<Res>): (either: Either<GrpcServiceError, Res>) => void {
    return either => {
        either.fold(
            (error: GrpcServiceError) => callback(error as grpc.ServiceError, null),
            (res: Res) => callback(null, res),
        );
    };
}

function handleError<Res>(callback: grpc.sendUnaryData<Res>): (error: any) => void {
    return (error: any) => {
        console.error(error);
        const error_pb = serviceError(error.toString(), grpc.status.INTERNAL);
        callback(error_pb as grpc.ServiceError, null);
    };
}


function handlers<L, R>(handleL: (l: L) => void, handleR: (r: R) => Promise<void[]>) {
    return ([l, r]: [L, R]) => Promise.all([handleL(l), handleR(r)]);
}

const service: grpc.UntypedServiceImplementation = {
    retrieveCatalogOptions: (call: grpc.ServerUnaryCall<messages.RetrieveCatalogOptionsRequest>,
                             callback: grpc.sendUnaryData<messages.CatalogOptions>) =>
        retrieveCatalogOptionsInner(call.request)
            .run(datastore)
            .then(
                handlers(handleResult(callback), handleEffects),
                handleError(callback)
            ),

    createCatalog: (call: grpc.ServerUnaryCall<messages.CreateCatalogRequest>,
                    callback: grpc.sendUnaryData<messages.CatalogOptions>) =>
        createCatalogInner(call.request, new Date())
            .run(datastore)
            .then(
                handlers(handleResult(callback), handleEffects),
                handleError(callback)
            ),

    updateCatalog: (call: grpc.ServerUnaryCall<messages.UpdateCatalogRequest>,
                    callback: grpc.sendUnaryData<messages.CatalogOptions>) =>
        updateCatalogInner(call.request)
            .run(datastore)
            .then(
                handlers(handleResult(callback), handleEffects),
                handleError(callback)
            ),

    retrieveCatalog: (call: grpc.ServerUnaryCall<messages.RetrieveCatalogRequest>,
                      callback: grpc.sendUnaryData<messages.Catalog>) =>
        retrieveCatalogInner(call.request)
            .run(datastore)
            .then(
                handlers(handleResult(callback), handleEffects),
                handleError(callback)
            ),

    listCatalogs: (call: grpc.ServerUnaryCall<messages.ListCatalogsRequest>,
                   callback: grpc.sendUnaryData<messages.ListCatalogsResponse>) =>
        listCatalogsInner(call.request)
            .run(datastore)
            .then(
                handlers(handleResult(callback), handleEffects),
                handleError(callback)
            ),
};

function main() {
    const PORT = process.env.PORT || 8080;
    const port = `0.0.0.0:${PORT}`;

    const server = new grpc.Server();
    server.addService(CatalogManagerService, service);
    server.bind(port, grpc.ServerCredentials.createInsecure());
    server.start();

    console.log(`Started gRPC service on ${port}`);
}

main();
