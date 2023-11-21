import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Feedback } from './entities/feedback.entity';
import { ScheduleModule } from '@nestjs/schedule';
import { FeedbackService } from './services/feedback.service';
import { Consultation } from '../consultation/entities/consultation.entity';
import { FeedbackController } from './controllers/feedback.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([Feedback, Consultation]),
        ScheduleModule.forRoot()
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
