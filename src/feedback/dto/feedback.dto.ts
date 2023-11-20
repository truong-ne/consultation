import { ApiProperty } from "@nestjs/swagger"
import { IsNotEmpty, IsNumber, IsString, Max, Min } from "class-validator"

export class UserFeedbackDto {
    @IsNotEmpty()
    @ApiProperty({ example: '6LmV48DQoCt54quQg0e0v' })
    @IsString()
    feedback_id: string

    @IsNotEmpty()
    @IsNumber()
    @ApiProperty({ example: 5 })
    @Min(0)
    @Max(5)
    rated: number

    @IsNotEmpty()
    @ApiProperty({ example: 'Bs. Phát tư vấn quá kém' })
    @IsString()
    feedback: string
}