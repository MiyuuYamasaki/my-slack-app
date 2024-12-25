// global.d.ts
declare global {
  var prisma: PrismaClient | undefined; // PrismaClientのインスタンスをグローバルに持つ
}

export {};
