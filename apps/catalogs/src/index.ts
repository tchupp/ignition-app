import Datastore = require("@google-cloud/datastore");
import * as grpc from "grpc";
// @ts-ignore
import {CatalogManagerService} from "../generated/catalogs_grpc_pb";
import * as messages from "../generated/catalogs_pb";

import {Either} from "fp-ts/lib/Either";

import {retrieveCatalogOptions as retrieveCatalogOptionsInner} from "./methods/catalog.retrieve.options.handler";
import {retrieveCatalog as retrieveCatalogInner} from "./methods/catalog.retrieve.handler";
import {createCatalog as createCatalogInner} from "./methods/catalog.create.handler";
import {listCatalogs as listCatalogsInner} from "./methods/catalog.list.handler";
import {GrpcServiceError, serviceError} from "./infrastructure/errors.pb";
import {CatalogsEffect} from "./infrastructure/effects";

const datastore = new Datastore();

function handleResult<Res>(callback: grpc.sendUnaryData<Res>): ([either, _effects]: [Either<GrpcServiceError, Res>, ReadonlyArray<CatalogsEffect>]) => void {
    return ([either, _effects]) =>
        either.fold(
            (error: GrpcServiceError) => callback(error as grpc.ServiceError, null),
            (res: Res) => callback(null, res),
        );
}

function handleError<Res>(callback: grpc.sendUnaryData<Res>): (error: any) => void {
    return (error: any) => {
        console.error(error);
        const error_pb = serviceError(error.toString(), grpc.status.INTERNAL);
        callback(error_pb as grpc.ServiceError, null);
    };
}


const service: grpc.UntypedServiceImplementation = {
    retrieveCatalogOptions: (call: grpc.ServerUnaryCall<messages.RetrieveCatalogOptionsRequest>,
                             callback: grpc.sendUnaryData<messages.CatalogOptions>) =>
        retrieveCatalogOptionsInner(call.request)
            .run(datastore)
            .then(handleResult(callback))
            .catch(handleError(callback)),

    createCatalog: (call: grpc.ServerUnaryCall<messages.CreateCatalogRequest>,
                    callback: grpc.sendUnaryData<messages.CatalogOptions>) =>
        createCatalogInner(call.request, new Date())
            .run(datastore)
            .then(handleResult(callback))
            .catch(handleError(callback)),

    retrieveCatalog: (call: grpc.ServerUnaryCall<messages.RetrieveCatalogRequest>,
                      callback: grpc.sendUnaryData<messages.Catalog>) =>
        retrieveCatalogInner(call.request)
            .run(datastore)
            .then(handleResult(callback))
            .catch(handleError(callback)),

    listCatalogs: (call: grpc.ServerUnaryCall<messages.ListCatalogsRequest>,
                   callback: grpc.sendUnaryData<messages.ListCatalogsResponse>) =>
        listCatalogsInner(call.request)
            .run(datastore)
            .then(handleResult(callback))
            .catch(handleError(callback)),
};


// hack to include source-map-support in runtime
// noinspection TsLint
require("source-map-support").install();

function main() {
    const port = '0.0.0.0:8080';

    const server = new grpc.Server();
    server.addService(CatalogManagerService, service);
    server.bind(port, grpc.ServerCredentials.createInsecure());
    server.start();

    console.log(`Started gRPC service on ${port}`);
}

main();
