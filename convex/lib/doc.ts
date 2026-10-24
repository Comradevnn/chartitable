// Doc<"table"> / Id<"table"> without codegen.
import type { DocumentByName, TableNamesInDataModel } from "convex/server";
import type { GenericId } from "convex/values";
import type { DataModel } from "./builders";

export type TableName = TableNamesInDataModel<DataModel>;
export type Doc<T extends TableName> = DocumentByName<DataModel, T>;
export type Id<T extends TableName> = GenericId<T>;
