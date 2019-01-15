import {status} from "grpc";

export enum DatastoreErrorCode {
    ABORTED = status.ABORTED,
    ALREADY_EXISTS = status.ALREADY_EXISTS,
    DEADLINE_EXCEEDED = status.DEADLINE_EXCEEDED,
    FAILED_PRECONDITION = status.FAILED_PRECONDITION,
    INTERNAL = status.INTERNAL,
    INVALID_ARGUMENT = status.INVALID_ARGUMENT,
    NOT_FOUND = status.NOT_FOUND,
    PERMISSION_DENIED = status.PERMISSION_DENIED,
    RESOURCE_EXHAUSTED = status.RESOURCE_EXHAUSTED,
    UNAUTHENTICATED = status.UNAUTHENTICATED,
    UNAVAILABLE = status.UNAVAILABLE,
}

export type DatastoreError = {
    readonly code: DatastoreErrorCode;
    readonly details: string;
}
