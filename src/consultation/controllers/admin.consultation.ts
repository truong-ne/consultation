import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
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
    @Get('consultation/chart/:month/:year')
    async consultationChart(@Param('month') month: number, @Param('year') year: number) {
        return await this.consultationService.consultationChart(month, year)
    }

    @UseGuards(AdminGuard)
    @ApiBearerAuth()
    @Get('/money/chart/:year')
    async moneyChart(@Param('year') year: number) {
        return await this.consultationService.moneyChart(year)
    }
}