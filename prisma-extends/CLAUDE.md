# Soft Delete Extension Rules

このリポジトリの `scripts/prisma-client.ts` には、soft delete の Prisma extension が実装されている。  
AI エージェント/開発者は以下のルールに従うこと。

## 1. Prisma Client の生成ルール

- MUST: `new PrismaClient()` を直接使わない。
- MUST: `createPrisma()` を使う。
- MUST NOT: soft delete が必要な処理で素の Prisma Client を生成しない。

```ts
import { createPrisma } from "./scripts/prisma-client";
const prisma = createPrisma();
```

## 2. 読み取りクエリの前提

- デフォルトで `deletedAt: null` が適用される対象:
  - `findMany`
  - `findFirst`
  - `findFirstOrThrow`
  - `findUnique`
  - `findUniqueOrThrow`
  - `count`
  - `aggregate`
  - `groupBy`
- `include/select` のネスト、`_count`、relation filter (`some/every/none`) も同様にスコープされる。

## 3. 削除済みデータを読む場合

- MUST: 削除済みデータを読むときは `withDeleted()` を使う。
- SHOULD: 削除済みのみを取得したい場合は `where: { deletedAt: { not: null } }` を併用する。

```ts
await prisma.withDeleted().user.findMany({
  where: { deletedAt: { not: null } },
});
```

## 4. delete 系のルール

- デフォルトの `delete/deleteMany` はソフトデリートに変換される（`deletedAt` を更新）。
- MUST: 物理削除が必要なときだけ `hardDelete()` を使う。
- MUST NOT: 通常フローで `hardDelete()` を使わない。

```ts
await prisma.user.delete({ where: { id } }); // soft delete
await prisma.hardDelete().user.delete({ where: { id } }); // hard delete
```

## 5. 実装変更時の必須チェック

- MUST: `pnpm run test` を通す。
- MUST: `pnpm run typecheck` を通す。
- SHOULD: `pnpm run check` を実行して統合確認する。

## 6. 仕様変更時に追加すべきテスト

- デフォルトスコープで削除済みが返らないこと
- `withDeleted()` で削除済みが返ること
- `delete/deleteMany` が soft delete になること
- `hardDelete()` で物理削除されること
- relation filter / `_count` のスコープが維持されること
- 引数オブジェクトが破壊的変更されないこと

## 7. 性能上の推奨

- SHOULD: `deletedAt` を使うモデルにはインデックスを検討する（例: `authorId + deletedAt`）。
- SHOULD: 大量データの画面/APIでは `withDeleted()` を常用しない。
