import { RabbitRPC } from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';
import { ConsultationService } from '../services/consultation.service';

@Injectable()
export class ScheduleConsumer {
    constructor(
        private readonly consultationService: ConsultationService
    ) { }

    @RabbitRPC({
        exchange: 'healthline.doctor.schedule',
        routingKey: 'schedule',
        queue: 'working_times',
    })
    async() {
        console.log(this.consultationService.VNTime())
        return this.consultationService.VNTime()
    }
}