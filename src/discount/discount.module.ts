import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Discount } from './entities/discount.entity';
import { DiscountService } from './services/discount.service';
import { DiscountController } from './controllers/discount.controller';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
    imports: [
        TypeOrmModule.forFeature([Discount]),
        ScheduleModule.forRoot()
    ],
    controllers: [
        DiscountController
    ],
    providers: [
        DiscountService
    ]
})
export class DiscountModule { }
