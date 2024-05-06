import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { BaseService } from "src/config/base.service";
import { Prescription } from "../entities/prescription.entiy";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { DataSource, Repository, getConnection } from "typeorm";
import { Consultation } from "../entities/consultation.entity";
import { PrescriptionDto } from "../dto/prescription.dto";
import { Status } from "src/config/enum.constants";

@Injectable()
export class PrescriptionService extends BaseService<Prescription> {
    constructor(
        @InjectRepository(Prescription) private readonly prescriptionRepository: Repository<Prescription>,
        @InjectRepository(Consultation) private readonly consultationRepository: Repository<Consultation>,
        private readonly amqpConnection: AmqpConnection,
    ) {
        super(prescriptionRepository)
    }

    async addPrescription(consultation_id: string, dto: PrescriptionDto[]): Promise<any> {
        const consultation = await this.consultationRepository.findOneBy({ id: consultation_id })
        if(!consultation) {
            throw new NotFoundException('consultation_not_found')
        }

        dto.forEach(async p => {
            var prescription = new Prescription()
            prescription.name = p.name
            prescription.consultation = consultation
            prescription.note = p.note
            prescription.quantity = p.quantity
            prescription.type = p.type
            prescription.unit = p.unit
            prescription.created_at = this.VNTime()
            prescription.updated_at = prescription.created_at

            await this.prescriptionRepository.save(prescription)
        })

        return {
            code: 200,
            message: 'success'
        }
    }

    async getPrescription(consultation_id: string): Promise<any> {
        const prescription = await this.prescriptionRepository.find({ where: { consultation: { id: consultation_id } }, relations: ['consultation'] })

        const data = []
        prescription.forEach(p => {
            data.push({
                name: p.name,
                type: p.type,
                note: p.note,
                quantity: p.quantity,
                unit: p.unit
            })
        })

        return {
            code: 200,
            message: 'success',
            data: data
        }
    }

    async updatePrescription(prescription_id: string, dto: PrescriptionDto): Promise<any> {
        const prescription = await this.prescriptionRepository.findOneBy({ id: prescription_id })
        if(!prescription) {
            throw new NotFoundException('prescription_not_found')
        }

        prescription.name = dto.name
        prescription.note = dto.note
        prescription.quantity = dto.quantity
        prescription.type = dto.type
        prescription.unit = dto.unit
        prescription.updated_at = this.VNTime()

        try {
            await this.prescriptionRepository.save(prescription)
        } catch (error) {
            throw new BadRequestException('updated_failed')
        }
    }

    async removePrescription(prescription_id: string): Promise<any> {
        const prescription = await this.prescriptionRepository.findOneBy({ id: prescription_id })
        if(!prescription) {
            throw new NotFoundException('prescription_not_found')
        }

        try {
            await this.prescriptionRepository.remove(prescription)
        } catch (error) {
            throw new BadRequestException('removed_failed')
        }
    }
}