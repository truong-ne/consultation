import { Body, Controller, Patch, Post, Get, UseGuards, Req, Inject, Delete, Param } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { ConsultationService } from "../services/consultation.service";
import { UserGuard } from "../../auth/guards/user.guard";
import { BookConsultation } from "../dto/consultation.dto";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import * as CryptoJS from 'crypto-js'

@ApiTags('USER CONSULTATION')
@Controller()
export class UserConsultation {
    constructor(
        private readonly consultationService: ConsultationService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly amqpConnection: AmqpConnection,
    ) { }
    @UseGuards(UserGuard)
    @ApiOperation({ summary: 'Khách hàng đặt 1 cuộc hẹn với bác sĩ' })
    @ApiBearerAuth()
    @Post()
    async bookConsultation(
        @Body() dto: BookConsultation,
        @Req() req
    ) {
        const working_time = await this.amqpConnection.request<string>({
            exchange: 'healthline.consultation.schedule',
            routingKey: 'schedule',
            payload: {
                doctor_id: dto.doctor_id,
                date: dto.date,
            },
            timeout: 10000
        })

        if (!!working_time['message']) {
            return { message: 'bug_message' }
        }

        const data = await this.consultationService.bookConsultation(req.user.id, dto, working_time)
        const momo = await this.paymentmomo(data.price)
        return { ...data, momo }
    }

    @UseGuards(UserGuard)
    @ApiOperation({ summary: 'Khách hàng hủy cuộc hẹn khi cuộc hẹn đang trong trạng thái pending' })
    @ApiBearerAuth()
    @Delete(':consultation_id')
    async cancelConsultation(
        @Param('consultation_id') consultation_id: string,
        @Req() req
    ) {
        return await this.consultationService.cancelConsultation(req.user.id, consultation_id)
    }

    @UseGuards(UserGuard)
    @ApiOperation({ summary: 'Tổng hợp các cuộc hẹn của khách hàng' })
    @ApiBearerAuth()
    @Get('user')
    async userConsultation(
        @Req() req
    ) {
        return await this.consultationService.userConsultation(req.user.id)
    }

    private async paymentmomo(amount: string,): Promise<any> {
        const date = new Date().getTime();
        const requestId = date + "id";
        const orderId = date + ":0123456778";
        const autoCapture = true;
        const requestType = "captureWallet";
        const notifyUrl = "https://sangle.free.beeceptor.com";
        const returnUrl = "https://sangle.free.beeceptor.com";
        // const amount = "10000";
        const orderInfo = "Thanh toán qua Website";
        const extraData = "ew0KImVtYWlsIjogImh1b25neGRAZ21haWwuY29tIg0KfQ==";
        let signature = "accessKey=" + 'klm05TvNBzhg7h7j' + "&amount=" + amount +
            "&extraData=" + extraData + "&ipnUrl=" + notifyUrl + "&orderId=" + orderId +
            "&orderInfo=" + orderInfo + "&partnerCode=" + 'MOMOBKUN20180529' + "&redirectUrl=" +
            returnUrl + "&requestId=" + requestId + "&requestType=" + requestType;
        const hash = await CryptoJS.HmacSHA256(signature, 'at67qH6mk8w5Y1nAyMoYKMWACiEi2bsa');
        signature = CryptoJS.enc.Hex.stringify(hash)


        const req = {
            "partnerCode": "MOMOBKUN20180529",
            "partnerName": "Test",
            "storeId": "MOMOBKUN20180529",
            "requestType": "captureWallet",
            "ipnUrl": "https://sangle.free.beeceptor.com",
            "redirectUrl": "https://sangle.free.beeceptor.com",
            "orderId": orderId,
            "amount": amount,
            "lang": "vi",
            "autoCapture": true,
            "orderInfo": "Thanh toán qua Website",
            "requestId": requestId,
            "extraData": extraData,
            "signature": signature
        }

        const data = await fetch('https://test-payment.momo.vn/v2/gateway/api/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req)
        })
        // console.log(await data.json())
        return await data.json()
    }
}