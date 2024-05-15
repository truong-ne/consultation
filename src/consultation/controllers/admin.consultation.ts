import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ConsultationService } from "../services/consultation.service";
import { AdminGuard } from "../../auth/guards/admin.guard";

@ApiTags('ADMIN CONSULTATION')
@Controller('admin')
export class AdminConsultation {
    constructor(
        private readonly consultationService: ConsultationService,
    ) { }
    
    @UseGuards(AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Biểu đồ cuộc hẹn theo tháng + năm' })
    @Get('consultation/chart/:month/:year')
    async consultationChart(@Param('month') month: number, @Param('year') year: number) {
        return await this.consultationService.consultationChart(month, year)
    }

    @UseGuards(AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: '10 bác sĩ có số lượng đặt lịch nhiều nhất trong tháng + năm' })
    @Get('top-10-doctor/:month/:year')
    async top10Doctor(@Param('month') month: number, @Param('year') year: number) {
        return await this.consultationService.top10Doctor(month, year)
    }

    @UseGuards(AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Biểu đồ chi tiêu của bệnh nhân theo tháng + năm' })
    @Get('money/medical/chart/:medicalId/:month/:year')
    async moneyChartOfMonthByMedicalId(@Param('medicalId') medicalId: string, @Param('month') month: number, @Param('year') year: number) {
        return await this.consultationService.moneyChartOfMonthByMedicalId(medicalId, month, year)
    }

    @UseGuards(AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Biểu đồ thu nhập của hệ thống theo năm' })
    @Get('money/chart/:year')
    async moneyChart(@Param('year') year: number) {
        return await this.consultationService.moneyChart(year)
    }

    @UseGuards(AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Biểu đồ thu nhập của bác sĩ theo tháng + năm' })
    @Get('money/doctor/chart/:doctorId/:month/:year')
    async moneyChartOfMonthByDoctorId(@Param('doctorId') doctorId: string, @Param('month') month: number, @Param('year') year: number) {
        return await this.consultationService.moneyChartOfMonthByDoctorId(doctorId, month, year)
    }

    @UseGuards(AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Các cuộc hẹn của bác sĩ' })
    @Get('doctor/:doctorId')
    async getConsultation(@Param('doctorId') doctorId: string) {
        return await this.consultationService.getConsultation(doctorId)
    }

    @UseGuards(AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Thống kê số lần khám của bệnh nhân theo năm' })
    @Get('medical/:year')
    async medicalStatistic(@Param('year') year: number) {
        return await this.consultationService.medicalStatistic(year)
    }

    @UseGuards(AdminGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Thống kê số lần khám của bệnh nhân theo năm' })
    @Get('medical/age/:month/:year')
    async ageChart(@Param('month') month: number, @Param('year') year: number) {
        return await this.consultationService.ageChart(month, year)
    }
}