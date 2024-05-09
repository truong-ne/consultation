import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { BaseService } from "src/config/base.service";
import { Prescription } from "../entities/prescription.entiy";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { DataSource, Repository, getConnection } from "typeorm";
import { Consultation } from "../entities/consultation.entity";
import { PrescriptionDto } from "../dto/prescription.dto";
import { Status } from "src/config/enum.constants";
import { Drug } from "../entities/drug.entity";

@Injectable()
export class PrescriptionService extends BaseService<Prescription> {
    constructor(
        @InjectRepository(Prescription) private readonly prescriptionRepository: Repository<Prescription>,
        @InjectRepository(Drug) private readonly drugRepository: Repository<Drug>,
        @InjectRepository(Consultation) private readonly consultationRepository: Repository<Consultation>,
        private readonly amqpConnection: AmqpConnection,
    ) {
        super(prescriptionRepository)
    }

    async addPrescription(consultation_id: string, dto: PrescriptionDto): Promise<any> {
        const consultation = await this.consultationRepository.findOneBy({ id: consultation_id })
        if(!consultation) {
            throw new NotFoundException('consultation_not_found')
        }

        var prescription = new Prescription()
        prescription.patientName = dto.patientName
        prescription.patientAddress = dto.patientAddress
        prescription.gender = dto.gender
        prescription.doctorName = dto.doctorName
        prescription.diagnosis = dto.diagnosis
        prescription.consultation = consultation
        prescription.created_at = this.VNTime()
        prescription.updated_at = prescription.created_at
        await this.prescriptionRepository.save(prescription)

        dto.drugs.forEach(async p => {
            var drug = new Drug()
            drug.name = p.name
            drug.note = p.note
            drug.code = p.code
            drug.quantity = p.quantity
            drug.type = p.type
            drug.prescription = prescription

            await this.drugRepository.save(drug)
        })

        return {
            code: 200,
            message: 'success'
        }
    }

    async getPrescription(consultation_id: string): Promise<any> {
        const prescription = await this.prescriptionRepository.findOne({ where: { consultation: { id: consultation_id } }, relations: ['consultation', 'drugs'] })

        const data = []
        prescription.drugs.forEach(p => {
            data.push({
                name: p.name,
                code: p.code,
                type: p.type,
                note: p.note,
                quantity: p.quantity,
            })
        })

        return {
            code: 200,
            message: 'success',
            data: {
                id: prescription.id,
                patientName: prescription.patientName,
                patientAddress: prescription.patientAddress,
                gender: prescription.gender,
                doctorName: prescription.doctorName,
                diagnosis: prescription.diagnosis,
                drugs: data,
                created_at: prescription.created_at,
            }
        }
    }
}