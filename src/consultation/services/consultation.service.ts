import { Injectable, NotFoundException, ConflictException, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { BaseService } from "../../config/base.service";
import { Doctor } from "../entities/doctor.entity";
import { Between, Repository } from "typeorm";
import { Consultation } from "../entities/consultation.entity";
import { User } from "../entities/user.entity";
import { Status } from "../../config/enum.constants";
import { BookConsultation } from "../dto/consultation.dto";
import * as fs from 'fs'
import * as jsonwebtoken from 'jsonwebtoken'
import * as uuid from 'uuid-random'
import { promisify } from 'util'
import * as dotenv from 'dotenv'
import { Discount } from "src/discount/entities/discount.entity";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
dotenv.config()

@Injectable()
export class ConsultationService extends BaseService<Consultation> {
    constructor(
        @InjectRepository(Consultation) private readonly consultationRepository: Repository<Consultation>,
        @InjectRepository(Doctor) private readonly doctorRepository: Repository<Doctor>,
        @InjectRepository(User) private readonly userRepository: Repository<User>,
        @InjectRepository(Discount) private readonly discountRepository: Repository<Discount>,
        private readonly amqpConnection: AmqpConnection
    ) {
        super(consultationRepository)
    }

    async doctorSchedule(doctor_id: string, date: string, working_time: string) {
        const doctor = await this.doctorRepository.findOne({
            where: { id: doctor_id }
        })

        if (!doctor) throw new NotFoundException('doctor_not_found')

        const bookingDate = await this.bDate(date, '', doctor, working_time)

        console.log("FLAG" + bookingDate)

        return {
            code: 200,
            message: "success",
            data: bookingDate
        }
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
        consultation.medical_record = dto.medical_record
        var date = new Date(dto.date.replace(/(\d+[/])(\d+[/])/, '$2$1'))
        if (isNaN(date.valueOf()))
            throw new BadRequestException('wrong_syntax')
        else
            consultation.date = date
        consultation.expected_time = dto.expected_time

        const times = (dto.expected_time.split("-").length) * 30
        if(dto.discount_code !== "") {
            const discount = await this.discountRepository.findOneBy({ code : dto.discount_code })
            if(!discount) throw new NotFoundException("discount_not_found")
            consultation.discount_code = discount
            if(discount.type === "vnd") {
                consultation.price = doctor.fee_per_minutes * 1 * 30 - discount.value
            } else consultation.price = doctor.fee_per_minutes * times - (doctor.fee_per_minutes * times / 100 * discount.value)
        } else
            consultation.price = doctor.fee_per_minutes * times

        if(user.account_balance >= consultation.price)
            user.account_balance -= consultation.price
        else throw new BadRequestException("you_have_not_enough_money")
        consultation.updated_at = this.VNTime()

        const data = await this.consultationRepository.save(consultation)

        try {
            await this.userRepository.save(user)
        } catch (error) {
            await this.consultationRepository.delete(data)
            throw new BadRequestException("create_consultation_failed")
        }
        return {
            data: {
                id: data.id,
                user: data.user.id,
                doctor: data.doctor.id,
                date: data.date,
                price: data.price,
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

    async userConsultation(userId: string) {
        const consultations = await this.consultationRepository.find({
            where: { user: { id: userId } },
            relations: ['doctor', 'user']
        })

        const data = {
            coming: [],
            finish: [],
            cancel: []
        }

        if(consultations.length === 0)
            return {
                code: 200,
                message: "success",
                data: data
            }

        const rabbitmq = await this.amqpConnection.request<any>({
            exchange: 'healthline.user.information',
            routingKey: 'medical',
            payload: Array.from(new Set(consultations.map(c => c.medical_record))),
            timeout: 10000,
        })

        if(rabbitmq.code !== 200) {
            return rabbitmq.message
        }
    
        consultations.forEach(c => {
            for(let i=0; i<rabbitmq.data.length; i++)
                if(c.medical_record === rabbitmq.data[i].uid) {
                    const consultation = {
                        id: c.id,
                        doctor: {
                            avatar: c.doctor.avatar,
                            full_name: c.doctor.full_name,
                            biography: c.doctor.biography
                        },
                        medical: rabbitmq.data[i],
                        date: c.date,
                        expected_time: c.expected_time,
                        price: c.price,
                        updated_at: c.updated_at
                    }
                    if(c.status === 'pending' || c.status === 'confirmed')
                        data.coming.push(consultation)
                    else if(c.status === 'finished')
                        data.finish.push(consultation)
                    else data.cancel.push(consultation)
                    break
                }
        })

        return {
            code: 200,
            message: "success",
            data: data
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

    async bDate(bdate: string, expected_time: string, doctor: Doctor, working_time: string) {
        var date = new Date(bdate.replace(/(\d+[/])(\d+[/])/, '$2$1'))
        if (isNaN(date.valueOf()))
            throw new BadRequestException('wrong_syntax')
        const consultations = await this.consultationRepository.find({
            where: {
                doctor: { id: doctor.id },
                date: date
            },
        })

        // if (!consultations)
        //     return []

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

    async calculateAverageRatingPerDoctor() {
        const consultations = await this.consultationRepository.find({
            relations: ['doctor', 'feedback']
        });

        const doctorRatingsMap = new Map<string, { totalRatings: number, numberOfRatings: number, quantity: number }>();

        consultations.forEach((consultation) => {
            if (consultation.feedback) {
                const doctorId = consultation.doctor.id;

                if (!doctorRatingsMap.has(doctorId)) {
                    doctorRatingsMap.set(doctorId, { totalRatings: 0, numberOfRatings: 0, quantity: 0 });
                }

                const doctorRatings = doctorRatingsMap.get(doctorId);

                doctorRatings.quantity++
                if (consultation.feedback && consultation.feedback.rated !== null) {
                    doctorRatings.totalRatings += consultation.feedback.rated;
                    doctorRatings.numberOfRatings++;
                }
            }
        });

        const averageRatingsPerDoctor = [];

        doctorRatingsMap.forEach((ratings, doctorId) => {
            const averageRating =
                ratings.numberOfRatings > 0 ? ratings.totalRatings / ratings.numberOfRatings : 0;

            averageRatingsPerDoctor.push({
                doctor_id: doctorId,
                averageRating: averageRating.toFixed(1),
                quantity: ratings.quantity
            });
        });

        return averageRatingsPerDoctor;
    }

    async consultationDashboard() {
        const startOfMonth = this.VNTime(-this.VNTime().getUTCDate() + 1)
        const endOfMonth = this.VNTime(-this.VNTime().getUTCDate() + 1).getMonth() === 11 ? this.VNTime(32 - this.VNTime().getUTCDate()) : this.VNTime(0);

        const quantityThisMonth = await this.consultationRepository.count({
            where: {
                updated_at: Between(startOfMonth, endOfMonth)
            }
        })

        const quantity = await this.consultationRepository.count()

        return {
            data: {
                quantity: quantity,
                quantityThisMonth: quantityThisMonth
            }
        }
    }

    async moneyDashboard() {
        const startOfMonth = this.VNTime(-this.VNTime().getUTCDate() + 1)
        const endOfMonth = this.VNTime(-this.VNTime().getUTCDate() + 1).getMonth() === 11 ? this.VNTime(32 - this.VNTime().getUTCDate()) : this.VNTime(0);

        let moneyThisMonth = await this.consultationRepository.sum('price', {
            status: Status.finished,
            date: Between(startOfMonth, endOfMonth)
        })

        moneyThisMonth += await this.consultationRepository.sum('price', {
            status: Status.confirmed,
            date: Between(startOfMonth, endOfMonth)
        })

        let totalMoney = await this.consultationRepository.sum('price', { status: Status.finished })
        totalMoney += await this.consultationRepository.sum('price', { status: Status.confirmed })

        return {
            data: {
                totalMoney: totalMoney,
                quantityThisMonth: moneyThisMonth
            }
        }
    }

    async moneyChart() {
        const currentYear = this.VNTime().getUTCFullYear();

        const moneyByMonth = [];
        for (let month = 0; month < 12; month++) {
            const startOfMonth = new Date(currentYear, month, 1); // Ngày bắt đầu (1/1/2023)
            const endOfMonth = new Date(currentYear, month + 1, 0); // Ngày kết thúc (9/12/2023)

            let moneyThisMonth = await this.consultationRepository.sum('price', {
                status: Status.finished,
                date: Between(startOfMonth, endOfMonth)
            });

            moneyThisMonth += await this.consultationRepository.sum('price', {
                status: Status.confirmed,
                date: Between(startOfMonth, endOfMonth)
            });

            if (moneyThisMonth !== null) {
                moneyByMonth.push({
                    month: month + 1,
                    totalMoneyThisMonth: moneyThisMonth
                });
            } else {
                moneyByMonth.push({
                    month: month + 1,
                    totalMoneyThisMonth: 0
                });
            }
        }

        return {
            data: {
                moneyByMonth: moneyByMonth
            }
        };
    }

    async moneyChartByDoctorId(id: string) {
        const currentYear = this.VNTime().getUTCFullYear();

        const moneyByMonth = [];
        for (let month = 0; month < 12; month++) {
            const startOfMonth = new Date(currentYear, month, 1); // Ngày bắt đầu (1/1/2023)
            const endOfMonth = new Date(currentYear, month + 1, 0); // Ngày kết thúc (9/12/2023)

            let moneyThisMonth = await this.consultationRepository.sum('price', {
                status: Status.finished,
                date: Between(startOfMonth, endOfMonth),
                doctor: { id: id }
            });

            moneyThisMonth += await this.consultationRepository.sum('price', {
                status: Status.confirmed,
                date: Between(startOfMonth, endOfMonth),
                doctor: { id: id }
            });

            if (moneyThisMonth !== null) {
                moneyByMonth.push({
                    month: month + 1,
                    totalMoneyThisMonth: moneyThisMonth
                });
            } else {
                moneyByMonth.push({
                    month: month + 1,
                    totalMoneyThisMonth: 0
                });
            }
        }

        return {
            data: {
                moneyByMonth: moneyByMonth
            }
        };
    }

    async consultationChart() {
        const finish = await this.consultationRepository.count({
            where: { status: Status.finished }
        })

        const confirm = await this.consultationRepository.count({
            where: { status: Status.confirmed }
        })

        const pending = await this.consultationRepository.count({
            where: { status: Status.pending }
        })

        const cancel = await this.consultationRepository.count({
            where: { status: Status.canceled }
        })

        const denied = await this.consultationRepository.count({
            where: { status: Status.denied }
        })

        return {
            data: {
                finish: finish,
                confirm: confirm,
                pending: pending,
                cancel: cancel + denied
            }
        }
    }

    async countUserByDoctorConsultation(doctor_id: string): Promise<any> {
        const doctor = await this.doctorRepository.findOne({
            where: { id: doctor_id }
        })

        if (!doctor)
            throw new NotFoundException('doctor_not_found')

        const consultations = await this.consultationRepository.find({
            where: { doctor: doctor, status: Status.finished },
            relations: ['user']
        })

        const data = []
        let quantity = 0
        for (const consultation of consultations) {
            quantity++;
            const info = {
                medical_id: consultation.medical_record,
                phone: consultation.user.phone,
                email: consultation.user.email,
            }
            data.push(info)
        }

        return {
            data: {
                consultation: data,
                quantity: quantity
            },
        }
    }

    generate({ id, name, email, avatar, appId, kid, time }) {
        const jwt = jsonwebtoken.sign({
            aud: 'jitsi',
            iss: 'chat',
            "iat": Date.now(),
            "exp": Date.now() + 1000 * 60 * time,
            "nbf": Date.now() + 5000,
            sub: appId,
            context: {
                features: {
                    "livestreaming": true,
                    "outbound-call": true,
                    "sip-outbound-call": true,
                    "transcription": true,
                    "recording": true
                },
                user: {
                    id,
                    name,
                    avatar,
                    email: email,
                    moderator: false,
                    "hidden-from-recorder": false,
                }
            },
            room: '*',
        }, process.env.PRIVATE_CONSULTATION, { algorithm: 'RS256', header: { kid } })
        return jwt;
    }
}