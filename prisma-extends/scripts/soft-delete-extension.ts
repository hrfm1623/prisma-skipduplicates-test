import { Prisma, PrismaClient } from "@prisma/client";

type ModelName = Prisma.ModelName;
type PlainObject = Record<string, unknown>;

type RelationFieldMeta = {
  isList: boolean;
  targetModel: ModelName;
};

const SOFT_DELETE_FIELD = "deletedAt";

const { relationFieldsByModel, softDeleteModels } = buildModelMetadata();

function buildModelMetadata() {
  const relationFieldsByModel = new Map<ModelName, Map<string, RelationFieldMeta>>();
  const softDeleteModels = new Set<ModelName>();

  for (const model of Prisma.dmmf.datamodel.models) {
    const modelName = model.name as ModelName;
    const relations = new Map<string, RelationFieldMeta>();

    for (const field of model.fields) {
      if (field.name === SOFT_DELETE_FIELD) {
        softDeleteModels.add(modelName);
      }

      if (field.kind !== "object") {
        continue;
      }

      relations.set(field.name, {
        isList: field.isList,
        targetModel: field.type as ModelName,
      });
    }

    relationFieldsByModel.set(modelName, relations);
  }

  return { relationFieldsByModel, softDeleteModels };
}

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeDeletedAtFilter(where: unknown): PlainObject {
  if (where == null) {
    return { [SOFT_DELETE_FIELD]: null };
  }

  return { AND: [where, { [SOFT_DELETE_FIELD]: null }] };
}

function applyNestedRelationScopes(modelName: ModelName, args: PlainObject): void {
  const relations = relationFieldsByModel.get(modelName);
  if (!relations) {
    return;
  }

  for (const key of ["include", "select"] as const) {
    const relationContainer = args[key];
    if (!isPlainObject(relationContainer)) {
      continue;
    }

    for (const [relationName, relationSelection] of Object.entries(relationContainer)) {
      const relation = relations.get(relationName);
      if (!relation) {
        continue;
      }

      if (relationSelection === true) {
        if (relation.isList && softDeleteModels.has(relation.targetModel)) {
          relationContainer[relationName] = { where: { [SOFT_DELETE_FIELD]: null } };
        }
        continue;
      }

      if (!isPlainObject(relationSelection)) {
        continue;
      }

      if (relation.isList && softDeleteModels.has(relation.targetModel)) {
        relationSelection.where = mergeDeletedAtFilter(relationSelection.where);
      }

      applyNestedRelationScopes(relation.targetModel, relationSelection);
    }
  }
}

function scopeFindManyArgs(modelName: ModelName, args: unknown): PlainObject {
  const scopedArgs = isPlainObject(args) ? { ...args } : {};

  if (softDeleteModels.has(modelName)) {
    scopedArgs.where = mergeDeletedAtFilter(scopedArgs.where);
  }

  applyNestedRelationScopes(modelName, scopedArgs);
  return scopedArgs;
}

export function extendWithSoftDelete(baseClient: PrismaClient) {
  return baseClient
    .$extends({
      name: "soft-delete-scope",
      query: {
        $allModels: {
          async findMany({ model, args, query }) {
            const modelName = model as ModelName;
            return query(scopeFindManyArgs(modelName, args));
          },
        },
      },
    })
    .$extends({
      name: "soft-delete-exception",
      client: {
        withDeleted() {
          return baseClient;
        },
      },
    });
}
