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
    ) { }

    @RabbitRPC({
        exchange: 'healthline.doctor.information',
        routingKey: 'information',
        queue: 'carp',
    })
    async listDoctor(data: any) {
        return await this.consultationService.calculateAverageRatingPerDoctor()
    }
}