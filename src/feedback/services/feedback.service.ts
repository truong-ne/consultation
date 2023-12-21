import { Injectable, NotFoundException, ConflictException, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { BaseService } from "../../config/base.service";
import { IsNull, Not, Repository } from "typeorm";
import { Status } from "../../config/enum.constants";
import { Feedback } from "../entities/feedback.entity";
import { Consultation } from "../../consultation/entities/consultation.entity";
import { Cron, CronExpression } from "@nestjs/schedule";
import { UserFeedbackDto } from "../dto/feedback.dto";
import { Doctor } from "../../consultation/entities/doctor.entity";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";


@Injectable()
export class FeedbackService extends BaseService<Feedback> {
    constructor(
        @InjectRepository(Consultation) private readonly consultationRepository: Repository<Consultation>,
        @InjectRepository(Feedback) private readonly feedbackRepository: Repository<Feedback>,
        @InjectRepository(Doctor) private readonly doctorRepository: Repository<Doctor>,
        private readonly amqpConnection: AmqpConnection
    ) {
        super(feedbackRepository)
    }

    @Cron(CronExpression.EVERY_30_SECONDS)
    async scheduleCron() {
        const fConsultation = await this.consultationRepository.find({
            where: {
                status: Status.finished,
                feedback: IsNull()
            },
            relations: ['user', 'feedback']
        })

        if (!fConsultation)
            return "successfully"

        for (const fcon of fConsultation) {
            const feedback = new Feedback()
            feedback.consultation = fcon
            feedback.user_id = fcon.user.id
            feedback.created_at = this.VNTime()

            await this.feedbackRepository.save(feedback)
        }
    }

    async userFeedback(user_id: string, dto: UserFeedbackDto) {
        const feedback = await this.feedbackRepository.findOne({
            where: { id: dto.feedback_id }
        })

        if (!feedback)
            throw new NotFoundException('feedback_not_found')

        if (feedback.rated)
            return { message: 'you_have_a_feedback_for_this_consultation' }

        if (user_id != feedback.user_id)
            throw new UnauthorizedException('unauthorized')

        feedback.rated = dto.rated
        feedback.feedback = dto.feedback

        await this.feedbackRepository.save(feedback)

        return { message: 'feedback_successfully' }
    }

    async getUserFeedback(user_id: string) {
        const feedbacks = await this.feedbackRepository.find({
            where: { user_id: user_id }
        })

        const data = []

        for (const feedback in feedbacks)
            data.push(feedback)

        return data
    }

    async ratedDoctor(doctor_id: string) {
        const consultations = await this.consultationRepository.find({
            where: { doctor: { id: doctor_id } },
            relations: ['feedback', 'doctor'],
            select: ['feedback']
        })

        const data = []
        const rating = [0, 0, 0, 0, 0]
        for (const consultation of consultations) {
            if (!consultation.feedback)
                continue
            data.push({
                id: consultation.feedback.id,
                user: await this.amqpConnection.request<any>({
                    exchange: 'healthline.user.information',
                    routingKey: 'medical',
                    payload: [consultation.medical_record],
                    timeout: 10000,
                }),
                feedback: consultation.feedback.feedback,
                rated: consultation.feedback.rated,
                created_at: consultation.feedback.created_at
            })
            if (consultation.feedback.rated === 1)
                rating[0]++
            else if (consultation.feedback.rated === 2)
                rating[1]++
            else if (consultation.feedback.rated === 3)
                rating[2]++
            else if (consultation.feedback.rated === 4)
                rating[3]++
            else if (consultation.feedback.rated === 5)
                rating[4]++
        }

        return {
            data: data,
            // rating: rating
        }
    }
}