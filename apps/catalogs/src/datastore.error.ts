export type DatastoreErrorStatus =
    "ABORTED"
    | "ALREADY_EXISTS"
    | "DEADLINE_EXCEEDED"
    | "FAILED_PRECONDITION"
    | "INTERNAL"
    | "INVALID_ARGUMENT"
    | "NOT_FOUND"
    | "PERMISSION_DENIED"
    | "RESOURCE_EXHAUSTED"
    | "UNAUTHENTICATED"
    | "UNAVAILABLE";

export type DatastoreError = {
    readonly code: number;
    readonly message: string;
    readonly status: DatastoreErrorStatus;
}
