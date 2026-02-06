import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { createPrisma } from "../scripts/prisma-client";
import {
  ACTIVE_POST_TITLE,
  ACTIVE_USER_2_EMAIL,
  ACTIVE_USER_EMAIL,
  DELETED_POST_TITLE,
  DELETED_USER_EMAIL,
  resetAndSeedScenarioData,
} from "../scripts/scenario";

const prisma = createPrisma();

beforeEach(async () => {
  await resetAndSeedScenarioData(prisma);
});

after(async () => {
  await prisma.$disconnect();
});

test("findMany applies default scope on root and include", async () => {
  const users = await prisma.user.findMany({
    orderBy: { id: "asc" },
    include: { posts: { orderBy: { id: "asc" } } },
  });

  assert.deepEqual(
    users.map((user) => user.email),
    [ACTIVE_USER_EMAIL, ACTIVE_USER_2_EMAIL],
  );
  assert.ok(users.every((user) => user.deletedAt === null));

  const activeUser = users.find((user) => user.email === ACTIVE_USER_EMAIL);
  assert.ok(activeUser);
  assert.equal(activeUser.posts.length, 1);
  assert.equal(activeUser.posts[0].title, ACTIVE_POST_TITLE);
});

test("withDeleted findMany can fetch soft-deleted rows", async () => {
  const deletedUsers = await prisma.withDeleted().user.findMany({
    where: { deletedAt: { not: null } },
  });
  assert.equal(deletedUsers.length, 1);
  assert.equal(deletedUsers[0].email, DELETED_USER_EMAIL);

  const activeUser = await prisma.withDeleted().user.findFirst({
    where: { email: ACTIVE_USER_EMAIL },
    include: { posts: { orderBy: { id: "asc" } } },
  });
  assert.ok(activeUser);
  assert.equal(activeUser.posts.length, 2);
  assert.equal(activeUser.posts[1].title, DELETED_POST_TITLE);
});

test("findUnique/findFirst/count keep Prisma default behavior", async () => {
  const deletedByUnique = await prisma.user.findUnique({
    where: { email: DELETED_USER_EMAIL },
  });
  assert.ok(deletedByUnique);
  assert.notEqual(deletedByUnique.deletedAt, null);

  const deletedByFirst = await prisma.user.findFirst({
    where: { email: DELETED_USER_EMAIL },
  });
  assert.ok(deletedByFirst);

  const userCount = await prisma.user.count();
  const postCount = await prisma.post.count();
  assert.equal(userCount, 3);
  assert.equal(postCount, 3);
});

test("create/update/delete queries still work", async () => {
  const created = await prisma.user.create({
    data: {
      email: "runtime@example.com",
      name: "Runtime User",
    },
  });

  const updated = await prisma.user.update({
    where: { id: created.id },
    data: { name: "Runtime User Updated" },
  });
  assert.equal(updated.name, "Runtime User Updated");

  await prisma.user.delete({ where: { id: created.id } });

  const foundAfterDelete = await prisma.withDeleted().user.findUnique({
    where: { id: created.id },
  });
  assert.equal(foundAfterDelete, null);
});
