import { Injectable, NotFoundException, ConflictException, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { BaseService } from "../../config/base.service";
import { Code, IsNull, Not, Repository } from "typeorm";
import { DiscountType, Status } from "../../config/enum.constants";
import { Consultation } from "../../consultation/entities/consultation.entity";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Discount } from "../entities/discount.entity";
import { DiscountDto } from "../dto/discount.dto";


@Injectable()
export class DiscountService extends BaseService<Discount> {
    constructor(
        @InjectRepository(Discount) private readonly discountRepository: Repository<Discount>,
    ) {
        super(discountRepository)
    }

    @Cron(CronExpression.EVERY_10_MINUTES)
    async cronDiscount() {
        const discount = await this.getDiscount()
        console.log('Meilisync Discount')
        await fetch('https://meilisearch-truongne.koyeb.app/indexes/discount/documents', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer CHOPPER_LOVE_MEILISEARCH',
                'Content-type': 'application/json'
            },
            body: JSON.stringify(discount['data'])
        })
    }

    async createDiscount(dto: DiscountDto): Promise<any> {
        const cDiscount = await this.discountRepository.findOne({
            where: { code: dto.code }
        })

        if (cDiscount)
            throw new ConflictException('discount_exist')

        const discount = new Discount()
        var date = new Date(dto.expiration_time.replace(/(\d+[/])(\d+[/])/, '$2$1'))
        if (isNaN(date.valueOf()))
            throw new BadRequestException('wrong_syntax')
        else
            discount.expiration_time = date
        discount.code = dto.code
        discount.value = dto.value
        discount.type = dto.type

        const data = await this.discountRepository.save(discount)

        await fetch('https://meilisearch-truongne.koyeb.app/indexes/discount/documents', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer CHOPPER_LOVE_MEILISEARCH',
                'Content-type': 'application/json'
            },
            body: JSON.stringify({
                id: data.id,
                code: data.code,
                value: data.value,
                type: discount.type,
                expiration_time: data.expiration_time
            })
        })

        return {
            data: data
        }
    }

    async updateDiscount(id: string, dto: DiscountDto): Promise<any> {
        const discount = await this.discountRepository.findOne({
            where: { id: id }
        })

        if (!discount)
            throw new NotFoundException('not_found_discount')

        discount.code = dto.code
        discount.value = dto.value
        discount.type = dto.type
        var date = new Date(dto.expiration_time.replace(/(\d+[/])(\d+[/])/, '$2$1'))
        if (isNaN(date.valueOf()))
            throw new BadRequestException('wrong_syntax')
        else
            discount.expiration_time = date

        const data = await this.discountRepository.save(discount)

        return {
            data: data
        }
    }

    async deleteDiscount(id: string): Promise<any> {
        const discount = await this.discountRepository.findOne({
            where: { id: id }
        })

        if (!discount)
            throw new NotFoundException('not_found_discount')

        const data = await this.discountRepository.delete(discount)

        return {
            message: "successfully"
        }
    }

    async getDiscount(): Promise<any> {
        const listDiscount = await this.discountRepository.find()
        if (!listDiscount)
            throw new NotFoundException('not_found_discount')

        return { data: listDiscount }
    }
}