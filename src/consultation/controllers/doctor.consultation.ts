import { Body, Controller, Param, Post, Get, UseGuards, Req, Inject, Delete } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { ConsultationService } from "../services/consultation.service";
import { DoctorGuard } from "../../auth/guards/doctor.guard";
import { Status } from "../../config/enum.constants";

@ApiTags('DOCTOR CONSULTATION')
@Controller('doctor')
export class DoctorConsultation {
    constructor(
        private readonly consultationService: ConsultationService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache
    ) { }

    @UseGuards(DoctorGuard)
    @ApiOperation({ summary: 'Bác sĩ xác nhận cuộc hẹn của khách hàng' })
    @ApiBearerAuth()
    @Post(':consultation_id')
    async confirmConsultation(
        @Param('consultation_id') consultation_id: string,
        @Req() req
    ) {
        const data = await this.consultationService.doctorConsultation(req.user.id, consultation_id, Status.confirmed)
        return {
            data: data,
            message: 'consultation_confirmed'
        }
    }

    @UseGuards(DoctorGuard)
    @ApiOperation({ summary: 'Bác sĩ từ chối cuộc hẹn của khách hàng' })
    @ApiBearerAuth()
    @Delete(':consultation_id')
    async denyConsultation(
        @Param('consultation_id') consultation_id: string,
        @Req() req
    ) {
        const data = await this.consultationService.doctorConsultation(req.user.id, consultation_id, Status.denied)
        return {
            data: data,
            message: 'consultation_denied'
        }
    }

    @UseGuards(DoctorGuard)
    @ApiOperation({ summary: 'Bác sĩ từ chối cuộc hẹn của khách hàng' })
    @ApiBearerAuth()
    @Delete(':consultation_id')
    async finishedConsultation(
        @Param('consultation_id') consultation_id: string,
        @Req() req
    ) {
        const data = await this.consultationService.doctorConsultation(req.user.id, consultation_id, Status.finished)
        return {
            data: data,
            message: 'consultation_finished'
        }
    }
}