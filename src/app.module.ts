import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { postgresOption, redisClientOption } from './config/database.config';
import { CacheModule } from '@nestjs/cache-manager';
import { RedisClientOptions } from 'redis';
import { AuthModule } from './auth/auth.module';
import { ConsultationModule } from './consultation/consultation.module';
import { DiscountModule } from './discount/discount.module';
import { FeedbackModule } from './feedback/feedback.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      ...postgresOption,
      autoLoadEntities: true
    }),
    CacheModule.register<RedisClientOptions>({
      isGlobal: true,
      ...redisClientOption
    }),
    AuthModule,
    ConsultationModule,
    DiscountModule,
    FeedbackModule
  ],
})
export class AppModule { }
