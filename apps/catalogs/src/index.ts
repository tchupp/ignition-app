import Datastore = require("@google-cloud/datastore");
import * as grpc from "grpc";
// @ts-ignore
import {CatalogManagerService} from "../generated/catalogs_grpc_pb";
import * as messages from "../generated/catalogs_pb";

import {retrieveCatalog as retrieveCatalogInner} from "./catalog.retrieve.handler";
import {createCatalog as createCatalogInner} from "./catalog.create.handler";
import {Either} from "fp-ts/lib/Either";
import {GrpcServiceError} from "./errors.pb";


function handleResult<Res>(callback: grpc.sendUnaryData<Res>): (either: Either<GrpcServiceError, Res>) => void {
    return (either: Either<GrpcServiceError, Res>) =>
        either.fold(
            (error: GrpcServiceError) => {
                callback(error as unknown as grpc.ServiceError, null);
            },
            (res: Res) => callback(null, res),
        );
}

function handleError<Res>(callback: grpc.sendUnaryData<Res>): (error: any) => void {
    return (error: any) => {
        console.error(error);
        callback({
            name: "Internal Error",
            message: error.toString(),
            code: grpc.status.INTERNAL
        }, null);
    };
}

const service: grpc.UntypedServiceImplementation = {
    retrieveCatalog: (call: grpc.ServerUnaryCall<messages.RetrieveCatalogRequest>, callback: grpc.sendUnaryData<messages.Catalog>) =>
        retrieveCatalogInner(call.request, new Datastore())
            .subscribe(handleResult(callback), handleError(callback)),

    createCatalog: (call: grpc.ServerUnaryCall<messages.CreateCatalogRequest>, callback: grpc.sendUnaryData<messages.Catalog>) =>
        createCatalogInner(call.request, new Datastore())
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
