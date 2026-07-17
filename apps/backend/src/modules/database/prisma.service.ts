import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  
  public readonly db: PrismaClient;
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is required to initialize PrismaService');
    }

    const adapter = new PrismaPg({
      connectionString,
    });

    this.db = new PrismaClient({
      adapter,
    });
  }

  async onModuleInit() {
    try {
      await this.db.$connect();
      this.logger.log('🚀 Eterloop Database (PostgreSQL) connected successfully!');
    } catch (error) {
      this.logger.error('❌ Failed to connect to database', error);
    }
  }

  async onModuleDestroy() {
    await this.db.$disconnect();
  }
}
