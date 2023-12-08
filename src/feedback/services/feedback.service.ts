import { Injectable, NotFoundException, ConflictException, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { BaseService } from "../../config/base.service";
import { IsNull, Not, Repository } from "typeorm";
import { Status } from "../../config/enum.constants";
import { Feedback } from "../entities/feedback.entity";
import { Consultation } from "../../consultation/entities/consultation.entity";
import { Cron, CronExpression } from "@nestjs/schedule";
import { UserFeedbackDto } from "../dto/feedback.dto";


@Injectable()
export class FeedbackService extends BaseService<Feedback> {
    constructor(
        @InjectRepository(Consultation) private readonly consultationRepository: Repository<Consultation>,
        @InjectRepository(Feedback) private readonly feedbackRepository: Repository<Feedback>,
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

    async ratedDoctor(doctor_id: string) {
        const data = []

        const rated_one = await this.feedbackRepository.count({
            where: {
                consultation: { doctor: { id: doctor_id} },
                rated: 1
            } , relations: ['consultation']
        })

        data.push(rated_one)

        const rated_two = await this.feedbackRepository.count({
            where: {
                consultation: { doctor: { id: doctor_id} },
                rated: 2
            } , relations: ['consultation']
        })

        data.push(rated_two)

        const rated_three = await this.feedbackRepository.count({
            where: {
                consultation: { doctor: { id: doctor_id} },
                rated: 3
            } , relations: ['consultation']
        })

        data.push(rated_three)

        const rated_four = await this.feedbackRepository.count({
            where: {
                consultation: { doctor: { id: doctor_id} },
                rated: 4
            } , relations: ['consultation']
        })

        data.push(rated_four)

        const rated_five = await this.feedbackRepository.count({
            where: {
                consultation: { doctor: { id: doctor_id} },
                rated: 5
            } , relations: ['consultation']
        })

        data.push(rated_five)

        return { data: data }
    }
}