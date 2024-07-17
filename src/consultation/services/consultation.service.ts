import { Injectable, NotFoundException, ConflictException, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { BaseService } from "../../config/base.service";
import { Doctor } from "../entities/doctor.entity";
import { Between, In, LessThan, Repository } from "typeorm";
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
import { of } from "rxjs";
import { Cron, CronExpression } from "@nestjs/schedule";
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

    @Cron(CronExpression.EVERY_30_SECONDS)
    async scheduleCron() {
        const consultations = await this.consultationRepository.find({ where: { status: In([Status.confirmed, Status.pending]) }, relations: ['doctor', 'user'] })
        for (let consultation of consultations) {
            if (consultation.date.getTime() <= Date.now() && consultation.status === Status.confirmed) {
                consultation.status = Status.finished
                await this.consultationRepository.save(consultation)

                consultation.doctor.account_balance += consultation.price
                await this.doctorRepository.save(consultation.doctor)

                await this.amqpConnection.request<any>({
                    exchange: 'healthline.chat',
                    routingKey: 'room',
                    payload: { consultationId: consultation.id, medicalId: consultation.medical_record, doctorId: consultation.doctor.id, userId: consultation.user.id },
                    timeout: 10000,
                })
            }

            if (consultation.date.getTime() <= Date.now() && consultation.status === Status.pending) {
                consultation.status = Status.canceled
                await this.consultationRepository.save(consultation)

                consultation.user.account_balance += consultation.price
                await this.userRepository.save(consultation.user)
            }
        }
    }

    async doctorSchedule(doctor_id: string, date: string, working_time: string) {
        const doctor = await this.doctorRepository.findOne({
            where: { id: doctor_id },
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

    async dataConsultation(consultations: Consultation[]) {
        const data = {
            coming: [],
            finish: [],
            cancel: []
        }

        if (consultations.length === 0)
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

        if (rabbitmq.code !== 200) {
            return rabbitmq
        }

        const finished = consultations.filter(c => c.status === 'finished')


        const rooms = await this.amqpConnection.request<any>({
            exchange: 'healthline.chat',
            routingKey: 'get_room',
            payload: Array.from(new Set(finished.map(c => [c.doctor.id, c.user.id, c.medical_record]))),
            timeout: 10000,
        })

        consultations.forEach(c => {
            for (let item of rabbitmq.data)
                if (c.medical_record === item.id) {
                    const consultation = {
                        id: c.id,
                        doctor: {
                            avatar: c.doctor.avatar,
                            full_name: c.doctor.full_name,
                        },
                        medical: item,
                        date: c.date,
                        expected_time: c.expected_time,
                        price: c.price,
                        status: c.status,
                        jisti_token: c.jisti_token,
                        updated_at: c.updated_at,
                        feedback: c.feedback
                    }
                    if (c.status === 'pending' || c.status === 'confirmed')
                        data.coming.push(consultation)
                    else if (c.status === 'finished') {
                        for (let r of rooms) {
                            if (c.medical_record === r.medical_id && c.doctor.id === r.members[0] && c.user.id === r.members[1]) {
                                consultation['room'] = r._id
                                break
                            }
                        }
                        data.finish.push(consultation)
                    }
                    else data.cancel.push(consultation)
                    break
                }
        })

        return data
    }

    async getConsultation(doctor_id: string) {
        const consultations = await this.consultationRepository.find({
            where: { doctor: { id: doctor_id } },
            relations: ['doctor', 'user']
        })

        return await this.dataConsultation(consultations)
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

        if (dto.patient_records.length > 0) {
            const rabbitmq = await this.amqpConnection.request<any>({
                exchange: 'healthline.user.information',
                routingKey: 'patient',
                payload: dto.patient_records,
                timeout: 10000,
            })

            if (rabbitmq.code !== 200) {
                return rabbitmq
            }
        }

        const consultation = new Consultation()
        consultation.user = user
        consultation.doctor = doctor
        consultation.symptoms = dto.symptoms
        consultation.medical_history = dto.medical_history
        consultation.medical_record = dto.medical_record
        consultation.patient_records = dto.patient_records
        var date = new Date(dto.date.replace(/(\d+[/])(\d+[/])/, '$2$1'))
        if (isNaN(date.valueOf()))
            throw new BadRequestException('wrong_syntax')
        else
            consultation.date = date
        consultation.expected_time = dto.expected_time

        const times = (dto.expected_time.split("-").length) * 30
        if (dto.discount_code !== "") {
            const discount = await this.discountRepository.findOneBy({ code: dto.discount_code })
            if (!discount) throw new NotFoundException("discount_not_found")
            consultation.discount_code = discount
            if (discount.type === "vnd") {
                consultation.price = doctor.fee_per_minutes * 1 * 30 - discount.value
            } else consultation.price = doctor.fee_per_minutes * times - (doctor.fee_per_minutes * times / 100 * discount.value)
        } else
            consultation.price = doctor.fee_per_minutes * times

        if (user.account_balance >= consultation.price)
            user.account_balance -= consultation.price
        else throw new BadRequestException("you_have_not_enough_money")
        consultation.updated_at = this.VNTime()
        doctor

        const data_jisti = {
            id: uuid(),
            name: doctor.full_name,
            email: doctor.email,
            avatar: doctor.avatar,
            appId: "vpaas-magic-cookie-fd0744894f194f3ea748884f83cec195",
            kid: "vpaas-magic-cookie-fd0744894f194f3ea748884f83cec195/d3d290"
        }
        const jisti_token = this.generate(process.env.PRIVATE_CONSULTATION, data_jisti, bookingDate.length * 20)
        consultation.jisti_token = jisti_token

        if(dto.usePoint)
            consultation.price = consultation.price - user.point
        const data = await this.consultationRepository.save(consultation)

        await this.amqpConnection.request<any>({
            exchange: 'healthline.user.information',
            routingKey: 'pending_transaction',
            payload: { userId: user.id, doctor: { id: doctor.id, avatar: doctor.avatar, full_name: doctor.full_name }, amount: consultation.price },
            timeout: 10000,
        })

        try {
            await this.userRepository.save(user)
        } catch (error) {
            await this.consultationRepository.remove(data)
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
                status: data.status,
                jisti_token: data.jisti_token
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

        await this.refund(consultation.user.id, consultation.price)

        return {
            message: 'consultation_canceled'
        }
    }

    async cancelConsultationConfirm(user_id: string, consultation_id: string) {
        const consultation = await this.consultationRepository.findOne({
            where: { id: consultation_id },
            relations: ['user', 'doctor']
        })

        if (!consultation) throw new NotFoundException('consultation_not_found')

        if (consultation.user.id !== user_id)
            throw new UnauthorizedException('unauthorized')

        if (consultation.status !== Status.confirmed)
            throw new BadRequestException('can_not_cancel_because_status_is_not_confirm')

        consultation.status = Status.canceled
        await this.consultationRepository.save(consultation)

        await this.refund(consultation.user.id, consultation.price / 100 * 70)

        consultation.doctor.account_balance += consultation.price / 100 * 30
        await this.doctorRepository.save(consultation.doctor)

        await this.amqpConnection.request<any>({
            exchange: 'healthline.user.information',
            routingKey: 'pending_transaction',
            payload: { userId: consultation.user.id, doctor: { id: consultation.doctor.id, avatar: consultation.doctor.avatar, full_name: consultation.doctor.full_name }, amount: consultation.price },
            timeout: 10000,
        })

        return {
            code: 200,
            message: 'success'
        }
    }

    async userConsultation(userId: string) {
        const consultations = await this.consultationRepository.find({
            where: { user: { id: userId } },
            relations: ['doctor', 'user', 'feedback']
        })

        return await this.dataConsultation(consultations)
    }

    async refund(userId: string, money: number) {
        const user = await this.userRepository.findOneBy({ id: userId })
        user.account_balance += money

        await this.userRepository.save(user)
    }

    async doctorConsultation(doctor_id: string, consultation_id: string, status: Status) {
        const consultation = await this.consultationRepository.findOne({
            where: { id: consultation_id },
            relations: ['doctor', 'user']
        })

        if (!consultation) throw new NotFoundException('consultation_not_found')

        if (consultation.doctor.id !== doctor_id)
            throw new UnauthorizedException('unauthorized')

        if (consultation.status !== Status.pending)
            throw new BadRequestException('can_not_' + status + '_because_status_is_not_pending')

        if(status === Status.denied)
            await this.amqpConnection.request<any>({
                exchange: 'healthline.user.information',
                routingKey: 'denied_transaction',
                payload: { userId: consultation.user.id, doctor: { id: consultation.doctor.id, avatar: consultation.doctor.avatar, full_name: consultation.doctor.full_name }, amount: consultation.price },
                timeout: 10000,
            })

        consultation.status = status
        const data = await this.consultationRepository.save(consultation)

        await this.refund(consultation.user.id, consultation.price)

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
                averageRating: parseFloat(averageRating.toFixed(1)),
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

    async consultationDetail(consultationId: string, doctor_id: string) {
        const consultation = await this.consultationRepository.findOne({ where: { id: consultationId, doctor: { id: doctor_id } }, relations: ['doctor', 'feedback'] })

        var patient
        if (consultation.patient_records.length !== 0) {
            patient = await this.amqpConnection.request<any>({
                exchange: 'healthline.user.information',
                routingKey: 'patient',
                payload: consultation.patient_records,
                timeout: 10000,
            })

            if (patient.code !== 200) {
                return patient
            }
        }

        const medical = await this.amqpConnection.request<any>({
            exchange: 'healthline.user.information',
            routingKey: 'medical',
            payload: [consultation.medical_record],
            timeout: 10000,
        })

        if (medical.code !== 200) {
            return medical
        }

        const { patient_records, medical_record, doctor, ...data } = consultation
        return {
            code: 200,
            message: "success",
            data: {
                medical: medical.data[0],
                ...data,
                patient_records: patient ? patient.data : [],
                feedback: consultation.feedback ? consultation.feedback : null,
                rated: consultation.feedback ? consultation.feedback.rated : null
            }
        }
    }

    async countUserByDoctorConsultation(doctor_id: string): Promise<any> {
        const consultations = await this.consultationRepository.find({
            where: { doctor: { id: doctor_id }, status: Status.finished },
            relations: ['user', 'doctor']
        })

        if (consultations.length === 0)
            return {
                data: {
                    medicals: [],
                    quantity: 0
                },
            }

        const medicals = await this.amqpConnection.request<any>({
            exchange: 'healthline.user.information',
            routingKey: 'medical',
            payload: Array.from(new Set(consultations.map(c => c.medical_record))),
            timeout: 10000,
        })

        if (medicals.code !== 200) {
            return medicals
        }

        const data = []
        for (const medical of medicals.data) {
            for (let consultation of consultations)
                if (consultation.medical_record === medical.id) {
                    const info = {
                        ...medical,
                        phone: consultation.user.phone,
                        email: consultation.user.email,
                    }
                    data.push(info)
                    break
                }
        }

        return {
            data: {
                medicals: data,
                quantity: consultations.length
            },
        }
    }

    async consultationRecord(doctor_id: string, medical_id: string) {
        const consulations = await this.consultationRepository.find({ where: { medical_record: medical_id }, relations: ['doctor', 'feedback', 'prescription', 'prescription.drugs'] })



        const data = []
        for (let c of consulations) {
            var patient_records = []
            if (c.patient_records.length > 0)
                patient_records = (await this.amqpConnection.request<any>({
                    exchange: 'healthline.user.information',
                    routingKey: 'patient',
                    payload: c.patient_records,
                    timeout: 10000,
                })).data
            data.push({
                id: c.id,
                doctor: {
                    id: c.doctor.id,
                    full_name: c.doctor.full_name,
                    avatar: c.doctor.avatar,
                    email: c.doctor.email,
                    phone: c.doctor.phone,
                    gender: c.doctor.gender,
                },
                date: c.date,
                expected_time: c.expected_time,
                price: c.price,
                medical_history: c.medical_history,
                symptoms: c.symptoms,
                patient_records: patient_records,
                prescription: c.prescription,
                feedback: c.feedback,
            })
        }

        return {
            code: 200,
            message: 'success',
            data: data
        }
    }

    async countDoctorByUserConsultation(user_id: string): Promise<any> {
        const consultations = await this.consultationRepository.find({
            where: { user: { id: user_id }, status: Status.finished },
            relations: ['user', 'doctor']
        })

        if (consultations.length === 0)
            return {
                data: {
                    doctors: [],
                    quantity: 0
                },
            }

        const ids = Array.from(new Set(consultations.map(c => c.doctor.id)))
        const doctors = await this.doctorRepository.find({ where: { id: In(ids) } })

        const information = await this.amqpConnection.request<any>({
            exchange: 'healthline.doctor.information',
            routingKey: 'information'
        })

        const data = []
        for (const doctor of doctors) {
            for (let consultation of consultations)
                if (consultation.doctor.id === doctor.id) {
                    for (const i of information) {
                        var flag = false
                        if (doctor.id === i.doctor_id) {
                            flag = true
                            data.push({
                                id: doctor.id,
                                full_name: doctor.full_name,
                                avatar: doctor.avatar,
                                email: doctor.email,
                                phone: doctor.phone,
                                // dayOfBirth: doctor.dayOfBirth,
                                gender: doctor.gender,
                                // careers: doctor.careers,
                                // specialty: doctor.specialties,
                                // educationAndCertification: doctor.educationAndCertification,
                                // biography: doctor.biography,
                                fee_per_minutes: doctor.fee_per_minutes,
                                // account_balance: doctor.account_balance,
                                // is_active: doctor.isActive,
                                ratings: i.averageRating,
                                number_of_consultation: i.quantity,
                                // updated_at: doctor.updated_at
                            })
                            break
                        }
                    }
                    if (!flag) {
                        data.push({
                            id: doctor.id,
                            full_name: doctor.full_name,
                            avatar: doctor.avatar,
                            email: doctor.email,
                            phone: doctor.phone,
                            // dayOfBirth: doctor.dayOfBirth,
                            gender: doctor.gender,
                            // careers: doctor.careers,
                            // specialty: doctor.specialties,
                            // educationAndCertification: doctor.educationAndCertification,
                            // biography: doctor.biography,
                            fee_per_minutes: doctor.fee_per_minutes,
                            // account_balance: doctor.account_balance,
                            // is_active: doctor.isActive,
                            ratings: 0,
                            number_of_consultation: 0,
                            // updated_at: doctor.updated_at
                        })
                    }
                    break
                }
        }

        return {
            data: {
                doctors: data,
                quantity: consultations.length
            },
        }
    }

    generate(privateKey, { id, name, email, avatar, appId, kid }, time = null) {
        const now = new Date()
        const jwt = jsonwebtoken.sign({
            aud: 'jitsi',
            iss: 'chat',
            // "iat": Math.floor(Date.now() / 1000),
            // "exp": Math.floor(Date.now() / 1000 + 1000 * 60 * time),
            // "nbf": Math.floor(Date.now() / 1000 - 5),
            "iat": 1716719302,
            "exp": 2016726502,
            "nbf": 1716719297,
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
        }, privateKey, { algorithm: 'RS256', header: { kid } })
        return jwt;
    }

    async doctorDashboard(doctor_id: string) {
        const consultations = await this.consultationRepository.find({
            where: {
                doctor: { id: doctor_id },
                status: Status.finished
            },
            relations: ['feedback']
        })

        if (!consultations)
            return {
                data: {
                    money: 0,
                    countConsul: 0,
                    badFeedback: 0
                }
            }

        let money = 0
        const countConsul = await this.consultationRepository.count({
            where: {
                doctor: { id: doctor_id },
                status: Status.finished
            },
        })

        for (const consultation of consultations)
            money += consultation.price

        let badFeedback = 0
        for (const consultation of consultations) {
            if (consultation.feedback === null)
                continue
            else if (consultation.feedback.rated < 3)
                badFeedback += 1
        }


        return {
            data: {
                money: money,
                countConsul: countConsul,
                badFeedback: badFeedback
            }
        }
    }

    async checkMedicalInConsulation(id: string) {
        const medical = await this.consultationRepository.findBy({ status: In([Status.pending, Status.confirmed]), medical_record: id })

        return medical.length === 0
    }

    async consultationInformation(ids: string[]) {
        const consultation = await this.consultationRepository.find({ where: { id: In(ids) } })

        if (consultation.length < ids.length)
            return {
                code: 400,
                message: 'Not Found Consultation'
            }

        const data = []
        consultation.forEach(c => {
            data.push({
                date: c.date,
                expected_time: c.expected_time
            })
        })
        return data
    }

    //    
    //  Statistics for each doctor
    //  
    async statisticTable(doctorId: string): Promise<any> {
        const consultations = await this.consultationRepository.find({ where: { doctor: { id: doctorId } }, relations: ['doctor', 'discount_code'] })

        var sales = 0
        var discount = 0
        for (let c of consultations) {
            var times = (c.expected_time.split("-").length) * 30
            sales += times * c.doctor.fee_per_minutes
            if (c.discount_code !== null) {
                if (c.discount_code.type === "vnd") {
                    discount += c.discount_code.value
                } else discount += times * c.doctor.fee_per_minutes / 100 * c.discount_code.value
            }
        }

        const data = {
            "type_of_service": "Khám Bệnh Trực Tuyến",
            "quantity": consultations.length,
            "pending": consultations.filter((item) => { return item.status === "pending"; }).length,
            "confirmed": consultations.filter((item) => { return item.status === "confirmed"; }).length,
            "sales": sales,
            "finished": consultations.filter((item) => { return item.status === "finished"; }).length,
            "discount": discount,
            "denied": consultations.filter((item) => { return item.status === "denied"; }).length,
            "canceled": consultations.filter((item) => { return item.status === "canceled"; }).length,
            "revenue": sales - discount,
        }

        return {
            code: 200,
            message: "success",
            data: data
        }
    }

    async moneyChartByDoctorId(doctorId: string, year: number) {
        const moneyByMonth = [];
        for (let month = 0; month < 12; month++) {
            const startOfMonth = new Date(year, month, 1);
            const endOfMonth = new Date(year, month + 1, 0);
            let moneyThisMonth = await this.consultationRepository.sum('price', {
                status: Status.finished,
                date: Between(startOfMonth, endOfMonth),
                doctor: { id: doctorId }
            });

            moneyThisMonth += await this.consultationRepository.sum('price', {
                status: Status.confirmed,
                date: Between(startOfMonth, endOfMonth),
                doctor: { id: doctorId }
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
            code: 200,
            message: "success",
            data: {
                moneyByMonth: moneyByMonth
            }
        };
    }

    async familiarCustomers(doctorId: string): Promise<any> {
        const consultations = await this.consultationRepository.find({ where: { doctor: { id: doctorId }, status: Status.finished }, relations: ['doctor', "user"] })

        const countByFamiliar = {};

        for (let c of consultations) {
            if (countByFamiliar[c.user.id]) {
                countByFamiliar[c.user.id] += 1;
            } else {
                countByFamiliar[c.user.id] = 1;
            }
        }

        const sortedFamiliar = Object.keys(countByFamiliar).sort(
            (a, b) => countByFamiliar[b] - countByFamiliar[a]
        );

        const ids = sortedFamiliar.slice(0, 10);

        const rabbitmq = await this.amqpConnection.request<any>({
            exchange: 'healthline.user.information',
            routingKey: 'user',
            payload: ids,
            timeout: 10000,
        })

        return {
            code: 200,
            message: "success",
            data: rabbitmq.data
        }
    }

    async newCustomers(doctorId: string): Promise<any> {
        const consultations = await this.consultationRepository.find({ where: { doctor: { id: doctorId }, status: Status.finished }, relations: ['doctor', "user"] })

        const countByNew = {};

        for (let c of consultations) {
            countByNew[c.user.id] = c.date;
        }

        const sortedNew = Object.keys(countByNew).sort(
            (a, b) => countByNew[b] - countByNew[a]
        );

        const ids = sortedNew.slice(0, 10);

        const rabbitmq = await this.amqpConnection.request<any>({
            exchange: 'healthline.user.information',
            routingKey: 'user',
            payload: ids,
            timeout: 10000,
        })

        return {
            code: 200,
            message: "success",
            data: rabbitmq.data
        }
    }

    async moneyChartOfMonthByDoctorId(doctorId: string, month: number, year: number) {
        const startOfMonth = new Date(year, month - 1, 1); // Ngày bắt đầu (1/1/2023)
        const endOfMonth = new Date(year, month, 0); // Ngày kết thúc (9/12/2023)

        let consultations = await this.consultationRepository.find({
            where: [
                {
                    doctor: { id: doctorId },
                    status: Status.finished,
                    date: Between(startOfMonth, endOfMonth)
                },
                {
                    doctor: { id: doctorId },
                    status: Status.confirmed,
                    date: Between(startOfMonth, endOfMonth)
                },
                {
                    doctor: { id: doctorId },
                    status: Status.pending,
                    date: Between(startOfMonth, endOfMonth)
                }
            ], relations: ['doctor']
        });

        const payByMedical = {};

        for (let c of consultations) {
            if (payByMedical[c.date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })]) {
                payByMedical[c.date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })] += Math.round(c.price / 100 * 60);
            } else {
                payByMedical[c.date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })] = Math.round(c.price / 100 * 60);
            }
        }

        return {
            code: 200,
            message: 'success',
            data: {
                moneyChartOfMonth: payByMedical,
                consultation: consultations.length
            }
        }
    }

    //    
    //  Statistics for admin
    //  
    async consultationChart(month: number, year: number) {
        const startOfMonth = new Date(year, month - 1, 1); // Ngày bắt đầu (1/1/2023)
        const endOfMonth = new Date(year, month, 0); // Ngày kết thúc (9/12/2023)

        const finish = await this.consultationRepository.count({
            where: {
                status: Status.finished,
                date: Between(startOfMonth, endOfMonth)
            }
        })

        const confirm = await this.consultationRepository.count({
            where: {
                status: Status.confirmed,
                date: Between(startOfMonth, endOfMonth)
            }
        })

        const pending = await this.consultationRepository.count({
            where: {
                status: Status.pending,
                date: Between(startOfMonth, endOfMonth)
            }
        })

        const cancel = await this.consultationRepository.count({
            where: {
                status: Status.canceled,
                date: Between(startOfMonth, endOfMonth)
            }
        })

        const denied = await this.consultationRepository.count({
            where: {
                status: Status.denied,
                date: Between(startOfMonth, endOfMonth)
            }
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

    async moneyChart(year: number) {
        const moneyByMonth = [];
        const revenueByMonth = [];
        const doctorSalaryByMonth = []
        for (let month = 0; month < 12; month++) {
            const startOfMonth = new Date(year, month, 1); // Ngày bắt đầu (1/1/2023)
            const endOfMonth = new Date(year, month + 1, 0); // Ngày kết thúc (9/12/2023)

            let consultation = await this.consultationRepository.find({
                where: [
                    {
                        status: Status.finished,
                        date: Between(startOfMonth, endOfMonth)
                    },
                    {
                        status: Status.confirmed,
                        date: Between(startOfMonth, endOfMonth)
                    }
                ], relations: ['discount_code']
            });

            var originPrice = 0
            var revenue = 0
            consultation.forEach(c => {
                if (c.discount_code)
                    if (c.discount_code.type === "vnd")
                        originPrice += c.price + c.discount_code.value
                    else originPrice += Math.round(c.price / (100 - c.discount_code.value) * 100)
                else originPrice += c.price

                revenue += c.price
            })

            moneyByMonth.push({
                month: month + 1,
                moneyByMonth: originPrice
            });
            revenueByMonth.push({
                month: month + 1,
                revenueByMonth: revenue
            });
            doctorSalaryByMonth.push({
                month: month + 1,
                doctorSalaryByMonth: Math.round(revenue / 100 * 60)
            });
        }

        return {
            code: 200,
            message: 'success',
            data: {
                moneyByMonth: moneyByMonth,
                revenueByMonth: revenueByMonth,
                doctorSalaryByMonth: doctorSalaryByMonth
            }
        };
    }

    async ageChart(month: number, year: number) {
        const startOfMonth = new Date(year, month - 1, 1); // Ngày bắt đầu (1/1/2023)
        const endOfMonth = new Date(year, month, 0); // Ngày kết thúc (9/12/2023)

        let consultations = await this.consultationRepository.find({
            where: [
                {
                    status: Status.finished,
                    date: Between(startOfMonth, endOfMonth)
                },
                {
                    status: Status.confirmed,
                    date: Between(startOfMonth, endOfMonth)
                }
            ]
        });

        const moneyByMedical = {}
        consultations.forEach(c => {
            if (!moneyByMedical[c.medical_record])
                moneyByMedical[c.medical_record] = 0
            moneyByMedical[c.medical_record] += c.price
        })

        const ids = Array.from(new Set(consultations.map(p => p.medical_record)))
        const rangeAge = await this.amqpConnection.request<any>({
            exchange: 'healthline.user.information',
            routingKey: 'range_age',
            payload: { ids: ids, year: year },
            timeout: 10000,
        })

        for (let key in rangeAge) {
            var sumPrice = 0
            rangeAge[key].forEach(m => {
                sumPrice += moneyByMedical[m]
            })
            rangeAge[key] = sumPrice
        }

        return rangeAge
    }

    async medicalStatistic(year: number) {
        const oldYear = new Date(year - 1, 12, 0);

        const oldConsultation = await this.consultationRepository.find({
            where: [
                {
                    status: Status.finished,
                    date: LessThan(oldYear)
                },
                {
                    status: Status.confirmed,
                    date: LessThan(oldYear)
                }
            ]
        })
        const countByMedical = {}
        oldConsultation.forEach(c => {
            if (countByMedical[c.medical_record]) {
                countByMedical[c.medical_record] += 1;
            } else {
                countByMedical[c.medical_record] = 1;
            }
        })

        const medicalByMonth = []
        for (let month = 0; month < 12; month++) {
            const startOfMonth = new Date(year, month, 1);
            const endOfMonth = new Date(year, month + 1, 0);

            const consultations = await this.consultationRepository.find({
                where: [
                    {
                        status: Status.finished,
                        date: Between(startOfMonth, endOfMonth)
                    },
                    {
                        status: Status.confirmed,
                        date: Between(startOfMonth, endOfMonth)
                    }
                ]
            })
            var newMedical = 0
            var oldMedical = 0
            Array.from(new Set(consultations.map(p => p.medical_record))).forEach(c => {
                if (countByMedical[c]) {
                    oldMedical++
                    countByMedical[c]++
                }
                else {
                    newMedical++
                    countByMedical[c] = 1
                }
            })

            medicalByMonth.push({
                month: month + 1,
                newMedical: newMedical,
                oldMedical: oldMedical
            })
        }

        return {
            code: 200,
            message: 'success',
            data: {
                medicalByMonth: medicalByMonth
            }
        }
    }

    async top10Doctor(month: number, year: number) {
        const startOfMonth = new Date(year, month - 1, 1); // Ngày bắt đầu (1/1/2023)
        const endOfMonth = new Date(year, month, 0); // Ngày kết thúc (9/12/2023)

        let consultations = await this.consultationRepository.find({
            where: [
                {
                    status: Status.finished,
                    date: Between(startOfMonth, endOfMonth)
                },
                {
                    status: Status.confirmed,
                    date: Between(startOfMonth, endOfMonth)
                }
            ], relations: ['doctor']
        });

        const countByDoctor = {};

        for (let c of consultations) {
            if (countByDoctor[c.doctor.id]) {
                countByDoctor[c.doctor.id] += 1;
            } else {
                countByDoctor[c.doctor.id] = 1;
            }
        }

        const sortedFamiliar = Object.keys(countByDoctor).sort(
            (a, b) => countByDoctor[b] - countByDoctor[a]
        );

        const ids = sortedFamiliar.slice(0, 10);

        const rabbitmq = await this.amqpConnection.request<any>({
            exchange: 'healthline.doctor.information',
            routingKey: 'doctor',
            payload: ids,
            timeout: 10000,
        })

        const data = []
        rabbitmq.data.forEach(d => {
            data.push({
                ...d,
                consultation: countByDoctor[d.id]
            })
        })

        return {
            code: 200,
            message: "success",
            data: data.sort(
                (a, b) => b.consultation - a.consultation
            )
        }
    }

    //    
    //  Statistics for user
    //  
    async moneyChartOfMonthByMedicalId(medicalId: string, month: number, year: number) {
        const startOfMonth = new Date(year, month - 1, 1); // Ngày bắt đầu (1/1/2023)
        const endOfMonth = new Date(year, month, 0); // Ngày kết thúc (9/12/2023)

        let consultations = await this.consultationRepository.find({
            where: [
                {
                    medical_record: medicalId,
                    status: Status.finished,
                    date: Between(startOfMonth, endOfMonth)
                },
                {
                    medical_record: medicalId,
                    status: Status.confirmed,
                    date: Between(startOfMonth, endOfMonth)
                },
                {
                    medical_record: medicalId,
                    status: Status.pending,
                    date: Between(startOfMonth, endOfMonth)
                }
            ]
        });

        const payByMedical = {};

        for (let c of consultations) {
            if (payByMedical[c.date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })]) {
                payByMedical[c.date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })] += c.price;
            } else {
                payByMedical[c.date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })] = c.price;
            }
        }

        return {
            code: 200,
            message: 'success',
            data: {
                moneyChartOfMonth: payByMedical,
                consultation: consultations.length
            }
        }
    }
}