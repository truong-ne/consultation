import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrescriptionService } from "../services/prescription.service";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { UserGuard } from "src/auth/guards/user.guard";
import { PrescriptionDto } from "../dto/prescription.dto";

@ApiTags('PRESCRIPTION')
@Controller('prescription')
export class PrescriptionController {
    constructor(
        private readonly prescriptionService: PrescriptionService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }

    @ApiOperation({ summary: 'Lấy đơn thuốc của bệnh nhân' })
    @Get('/:consultation_id')
    async getPrescription(@Param('consultation_id') consultation_id: string) {
        return await this.prescriptionService.getPrescription(consultation_id)
    }

    @ApiOperation({ summary: 'Thêm đơn thuốc' })
    @Post('/:consultation_id')
    async addPrescription(@Param('consultation_id') consultation_id: string, @Body() dto: PrescriptionDto) {
        return await this.prescriptionService.addPrescription(consultation_id, dto)
    }
}