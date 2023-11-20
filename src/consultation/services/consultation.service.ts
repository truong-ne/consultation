import { Injectable, NotFoundException, ConflictException, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { BaseService } from "../../config/base.service";
import { Doctor } from "../entities/doctor.entity";
import { Repository } from "typeorm";
import { Consultation } from "../entities/consultation.entity";
import { User } from "../entities/user.entity";
import { Status } from "../../config/enum.constants";
import { BookConsultation } from "../dto/consultation.dto";

@Injectable()
export class ConsultationService extends BaseService<Consultation> {
    constructor(
        @InjectRepository(Consultation) private readonly consultationRepository: Repository<Consultation>,
        @InjectRepository(Doctor) private readonly doctorRepository: Repository<Doctor>,
        @InjectRepository(User) private readonly userRepository: Repository<User>
    ) {
        super(consultationRepository)
    }

    async bookConsultation(user_id: string, dto: BookConsultation, working_time: string) {
        const doctor = await this.doctorRepository.findOne({
            where: { id: dto.doctor_id }
        })

        if (!doctor) throw new NotFoundException('doctor_not_found')

        const bookingDate = await this.bDate(dto.date, dto.expected_time, doctor, working_time)

        const expected_time = await this.fixedStringToArray(dto.expected_time)

        let booked = false
        expected_time.forEach(e => {
            if (!bookingDate.includes(e))
                booked = true
        })

        if (booked)
            return { message: 'working_times_booked_or_not_found' }

        const user = await this.userRepository.findOne({
            where: { id: user_id }
        })

        const consultation = new Consultation()
        consultation.user = user
        consultation.doctor = doctor
        consultation.date = dto.date
        consultation.expected_time = dto.expected_time
        consultation.price = dto.price
        consultation.updated_at = this.VNTime()

        const data = await this.consultationRepository.save(consultation)

        return {
            data: {
                id: data.id,
                user: data.user.id,
                doctor: data.doctor.id,
                date: data.date,
                expected_time: data.expected_time,
                status: data.status
            },
            message: 'consultation_pending'
        }
    }

    async cancelConsultation(user_id: string, consultation_id: string) {
        const consultation = await this.consultationRepository.findOne({
            where: { id: consultation_id },
            relations: ['user']
        })

        if (!consultation) throw new NotFoundException('consultation_not_found')

        if (consultation.user.id !== user_id)
            throw new UnauthorizedException('unauthorized')

        if (consultation.status !== Status.pending)
            throw new BadRequestException('can_not_cancel_because_status_is_not_pending')

        consultation.status = Status.canceled
        await this.consultationRepository.save(consultation)

        return {
            message: 'consultation_canceled'
        }
    }

    async doctorConsultation(doctor_id: string, consultation_id: string, status: Status) {
        const consultation = await this.consultationRepository.findOne({
            where: { id: consultation_id },
            relations: ['doctor']
        })

        if (!consultation) throw new NotFoundException('consultation_not_found')

        if (consultation.doctor.id !== doctor_id)
            throw new UnauthorizedException('unauthorized')

        if (consultation.status !== Status.pending)
            throw new BadRequestException('can_not_' + status + '_because_status_is_not_pending')

        consultation.status = status
        const data = await this.consultationRepository.save(consultation)

        return {

            id: data.id,
            date: data.date,
            expected_time: data.expected_time,
            price: data.price,
            status: data.status
        }
    }

    async bDate(date: string, expected_time: string, doctor: Doctor, working_time: string) {
        const consultations = await this.consultationRepository.find({
            where: {
                doctor: { id: doctor.id },
                date: date
            },
        })

        const working_times = await this.fixedStringToArray(working_time)


        const booking = []

        for (const consultation of consultations) {
            const booking_time = await this.fixedStringToArray(consultation.expected_time)
            booking_time.forEach(e => {
                booking.push(e)
            });
        }

        const result = []
        for (let i = 0; i < working_times.length; i++) {
            if (!booking.includes(working_times[i])) {
                result.push(working_times[i]);
            }
        }

        return result
    }
}