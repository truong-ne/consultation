import { Column, Entity, JoinColumn, ManyToMany, OneToMany, OneToOne, PrimaryColumn } from "typeorm";
import { nanoid } from "nanoid";
import { Max, Min } from "class-validator";
import { Consultation } from "../../consultation/entities/consultation.entity";

@Entity({ name: 'Feedbacks' })
export class Feedback {
    constructor() {
        this.id = nanoid()
    }

    @PrimaryColumn()
    id: string

    @Column()
    user_id: string

    @Column({ nullable: true })
    @Min(0)
    @Max(5)
    rated: number

    @OneToOne(() => Consultation, consultation => consultation.feedback)
    consultation: Consultation

    @Column({ nullable: true })
    feedback: string

    @Column({ type: 'timestamp', name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;
}