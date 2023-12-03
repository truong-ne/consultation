import { AmqpConnection, RabbitRPC } from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';
import { ConsultationService } from '../services/consultation.service';

// class Dto {
//     doctor_id: string
//     date: string
// }
@Injectable()
export class ConsultationConsumer {
    constructor(
        private readonly consultationService: ConsultationService,
        private readonly amqpConnection: AmqpConnection,
    ) { }

    @RabbitRPC({
        exchange: 'healthline.doctor.information',
        routingKey: 'information',
        queue: 'doctor information',
    })
    async listDoctor(data: any) {
        return await this.consultationService.calculateAverageRatingPerDoctor()
    }

    @RabbitRPC({
        exchange: 'doctor.schedule',
        routingKey: 'schedule',
        queue: 'doctor information'
    })
    async doctorSchedule(data: any) {
        console.log(data)
        const working_time = await this.amqpConnection.request<string>({
            exchange: 'healthline.consultation.schedule',
            routingKey: 'schedule',
            payload: {
                doctor: data.doctor_id,
                date: data.date,
            },
            timeout: 10000
        })
        return await this.consultationService.doctorSchedule(data.doctor_id, data.date, working_time)
    }
}