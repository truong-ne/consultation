import { Body, Controller, Param, Post, Get, UseGuards, Req, Inject, Delete } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiProperty, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { ConsultationService } from "../services/consultation.service";
import { DoctorGuard } from "../../auth/guards/doctor.guard";
import { Status } from "../../config/enum.constants";
import { Admin } from "typeorm";
import { AdminGuard } from "src/auth/guards/admin.guard";
import * as uuid from 'uuid-random'
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { DateDto } from "../dto/consultation.dto";

@ApiTags('DOCTOR CONSULTATION')
@Controller('doctor')
export class DoctorConsultation {
    constructor(
        private readonly consultationService: ConsultationService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly amqpConnection: AmqpConnection,
    ) { }

    @UseGuards(DoctorGuard)
    @ApiOperation({ summary: 'Lấy tất cả cuộc hẹn của bác sĩ (admin + doctor)' })
    @ApiBearerAuth()
    @Get()
    async getConsultation(
        @Req() req
    ) {
        return await this.consultationService.getConsultation(req.user.id)
    }

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
    async finishedConsultation(
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
    @ApiBearerAuth()
    @Get('information')
    async constUserDoctorConsultationByDoctor(
        @Req() req
    ) {
        return await this.consultationService.countUserByDoctorConsultation(req.user.id)
    }

    @UseGuards(AdminGuard)
    @ApiBearerAuth()
    @Get('consultation/dashboard')
    async consultationDashboard() {
        return await this.consultationService.consultationDashboard()
    }

    @UseGuards(AdminGuard)
    @ApiBearerAuth()
    @Get('consultation/money')
    async moneyDashboard() {
        return await this.consultationService.moneyDashboard()
    }

    @UseGuards(DoctorGuard)
    @ApiBearerAuth()
    @Get('consultation/money/chart/:doctorId/:year')
    async moneyChartByDoctorIdAdmin(@Param('doctorId') doctorId: string, @Param('year') year: number) {
        return await this.consultationService.moneyChartByDoctorId(doctorId, year)
    }

    @UseGuards(DoctorGuard)
    @ApiBearerAuth()
    @Get('consultation/:consultationId')
    async consultationDetail(@Param('consultationId') consultationId: string, @Req() req) {
        return await this.consultationService.consultationDetail(consultationId, req.user.id)
    }

    @UseGuards(DoctorGuard)
    @ApiBearerAuth()
    @Get('doctor/dashboard')
    async doctorDashboard(@Req() req) {
        return await this.consultationService.doctorDashboard(req.user.id)
    }

    @Post(':id/schedule')
    async getDoctorSchedule(
        @Param('id') doctor_id: string,
        @Body() dto: DateDto
    ) {
        const working_time = await this.amqpConnection.request<string>({
            exchange: 'healthline.consultation.schedule',
            routingKey: 'schedule',
            payload: {
                doctor_id: doctor_id,
                date: dto.date,
            },
            timeout: 10000
        })

        if (!!working_time['message']) {
            return {
                code: 200,
                message: "success",
                data: []
            }
        }

        return await this.consultationService.doctorSchedule(doctor_id, dto.date, working_time)
    }

    @UseGuards(DoctorGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Xem lịch sử khám, hồ sơ khám bệnh' })
    @Get('/detail/medical/:medical_id')
    async countDoctorByUserConsultation(
        @Param('medical_id') medical_id: string,
        @Req() req
    ) {
        return await this.consultationService.consultationRecord(req.user.id, medical_id)
    }

    //    
    //  Statistics for each doctor
    //
    @UseGuards(DoctorGuard)
    @ApiBearerAuth()
    @Get('/statistic-table')
    async statisticTable(@Req() req) {
        return await this.consultationService.statisticTable(req.user.id)
    }

    @UseGuards(DoctorGuard)
    @ApiBearerAuth()
    @Get('/money-chart/:year')
    async moneyChartByDoctorId(@Param('year') year: number, @Req() req) {
        return await this.consultationService.moneyChartByDoctorId(req.user.id, year)
    }

    @UseGuards(DoctorGuard)
    @ApiBearerAuth()
    @Get('/familiar-customers')
    async familiarCustomers(@Req() req) {
        return await this.consultationService.familiarCustomers(req.user.id)
    }

    @UseGuards(DoctorGuard)
    @ApiBearerAuth()
    @Get('/new-customers')
    async newCustomers(@Req() req) {
        return await this.consultationService.newCustomers(req.user.id)
    }
}