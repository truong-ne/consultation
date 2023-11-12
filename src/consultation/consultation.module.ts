import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Doctor } from './entities/doctor.entity';
import { Consultation } from './entities/consultation.entity';
import { User } from './entities/user.entity';
import { UserConsultation } from './controllers/user.consultation';
import { DoctorConsultation } from './controllers/doctor.consultation';
import { ConsultationService } from './services/consultation.service';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import * as dotenv from 'dotenv'

dotenv.config()

@Module({
    imports: [
        TypeOrmModule.forFeature([Doctor, Consultation, User]),
        RabbitMQModule.forRoot(RabbitMQModule, {
            exchanges: [
                {
                    name: 'healthline.consultation.schedule',
                    type: 'direct',
                }
            ],
            uri: process.env.RABBITMQ_URL,
            connectionInitOptions: { wait: true, reject: true, timeout: 10000 },
        }),
    ],
    controllers: [
        UserConsultation,
        DoctorConsultation
    ],
    providers: [
        ConsultationService,
    ]
})
export class ConsultationModule { }
