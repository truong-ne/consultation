import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Feedback } from './entities/feedback.entity';
import { ScheduleModule } from '@nestjs/schedule';
import { FeedbackService } from './services/feedback.service';
import { Consultation } from '../consultation/entities/consultation.entity';
import { FeedbackController } from './controllers/feedback.controller';
import { Doctor } from '../consultation/entities/doctor.entity';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';

@Module({
    imports: [
        TypeOrmModule.forFeature([Feedback, Consultation, Doctor]),
        ScheduleModule.forRoot(),
        RabbitMQModule.forRoot(RabbitMQModule, {
            exchanges: [
                {
                    name: 'healthline.consultation.schedule',
                    type: 'direct',
                },
                {
                    name: 'healthline.doctor.information',
                    type: 'direct'
                },
                {
                    name: 'healthline.user.information',
                    type: 'direct'
                },
            ],
            uri: process.env.RABBITMQ_URL,
            connectionInitOptions: { wait: true, reject: true, timeout: 10000 },
        }),
    ],
    controllers: [
        FeedbackController
    ],
    providers: [
        FeedbackService
    ],
    exports: [
        FeedbackService
    ]
})
export class FeedbackModule { }
