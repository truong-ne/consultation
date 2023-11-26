import { Column, Entity, JoinColumn, ManyToMany, OneToMany, PrimaryColumn } from "typeorm";
import { nanoid } from "nanoid";
import { Consultation } from "../../consultation/entities/consultation.entity";
import { DiscountType } from "../../config/enum.constants";

@Entity({ name: 'Discounts' })
export class Discount {
    constructor() {
        this.id = nanoid()
    }

    @PrimaryColumn()
    id: string

    @Column()
    code: string

    @OneToMany(() => Consultation, consultation => consultation.discount_code)
    consultations: Consultation[]

    @Column()
    value: number

    @Column({ type: 'enum', enum: DiscountType, default: DiscountType.vnd })
    type: DiscountType

    @Column()
    expiration_time: Date

}