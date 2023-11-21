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

        if (feedback.rated)
            return { message: 'you_have_a_feedback_for_this_consultation' }

        if (user_id != feedback.user_id)
            throw new UnauthorizedException('unauthorized')

        if (!feedback)
            throw new NotFoundException('feedback_not_found')

        feedback.rated = dto.rated
        feedback.feedback = dto.feedback

        await this.feedbackRepository.save(feedback)

        return { message: 'feedback_successfully' }
    }
}