import { defineConfig } from '@prisma/internals';

export const prismaConfig = defineConfig({
  seed: 'ts-node prisma/seed.ts',
});

export default prismaConfig;
