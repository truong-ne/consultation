import { Body, Controller, Patch, Post, Get, UseGuards, Req, Inject, Delete, Param } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { UserGuard } from "../../auth/guards/user.guard";
import { DiscountService } from "../services/discount.service";
import { AdminGuard } from "src/auth/guards/admin.guard";
import { DiscountDto } from "../dto/discount.dto";

@ApiTags('DISCOUNT')
@Controller('discount')
export class DiscountController {

    constructor(
        private readonly discountService: DiscountService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }

    @UseGuards(AdminGuard)
    @ApiOperation({ summary: 'Admin tạo discount' })
    @ApiBearerAuth()
    @Post()
    async createDiscount(
        @Body() dto: DiscountDto,
    ) {
        return await this.discountService.createDiscount(dto)
    }

    @UseGuards(AdminGuard)
    @ApiOperation({ summary: 'Admin thông tin discount' })
    @ApiBearerAuth()
    @Patch('/:id')
    async updateDiscount(
        @Param('id') id: string,
        @Body() dto: DiscountDto,
    ) {
        return await this.discountService.updateDiscount(id, dto)
    }

    @UseGuards(AdminGuard)
    @ApiOperation({ summary: 'Admin xóa discount' })
    @ApiBearerAuth()
    @Delete('/:id')
    async deleteDiscount(
        @Param('id') id: string,
    ) {
        return await this.discountService.deleteDiscount(id)
    }
}