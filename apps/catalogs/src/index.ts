import Datastore = require("@google-cloud/datastore");
import * as grpc from "grpc";
// @ts-ignore
import {CatalogManagerService} from "../generated/catalogs_grpc_pb";
import * as messages from "../generated/catalogs_pb";

import {Either} from "fp-ts/lib/Either";

import {retrieveCatalog as retrieveCatalogInner} from "./catalog.retrieve.handler";
import {createCatalog as createCatalogInner} from "./catalog.create.handler";
import {GrpcServiceError, serviceError} from "./errors.pb";

const datastore = new Datastore();

function handleResult<Res>(callback: grpc.sendUnaryData<Res>): (either: Either<GrpcServiceError, Res>) => void {
    return (either: Either<GrpcServiceError, Res>) =>
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
    retrieveCatalogOptions: (call: grpc.ServerUnaryCall<messages.RetrieveCatalogOptionsRequest>, callback: grpc.sendUnaryData<messages.CatalogOptions>) =>
        retrieveCatalogInner(call.request, datastore)
            .subscribe(handleResult(callback), handleError(callback)),

    createCatalog: (call: grpc.ServerUnaryCall<messages.CreateCatalogRequest>, callback: grpc.sendUnaryData<messages.CatalogOptions>) =>
        createCatalogInner(call.request, datastore)
            .subscribe(handleResult(callback), handleError(callback))
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
