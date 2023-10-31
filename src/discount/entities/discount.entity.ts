import { Column, Entity, JoinColumn, ManyToMany, OneToMany, PrimaryColumn } from "typeorm";
import { nanoid } from "nanoid";
import { Consultation } from "../../consultation/entities/consultation.entity";

@Entity({ name: 'Discounts' })
export class Discount {
    constructor() {
        this.id = nanoid()
    }

    @PrimaryColumn()
    id: string

    @OneToMany(() => Consultation, consultation => consultation.discount_code)
    code: string

    @Column()
    value: number

    @Column()
    type: string

    @Column()
    expiration_time: Date

}