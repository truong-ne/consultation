import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Discount } from './entities/discount.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Discount])
    ]
})
export class DiscountModule { }
