import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsDateString, IsEnum, IsNotEmpty, IsNumber, IsString, Matches, Max, Min } from "class-validator";

export class PrescriptionDto {
    @IsNotEmpty()
    @ApiProperty({ example: 'paracetamol' })
    @IsString()
    name: string

    @IsNotEmpty()
    @ApiProperty({ example: 'Vien nen' })
    @IsString()
    type: string

    @IsNotEmpty()
    @ApiProperty({ example: 'uong sau khi an' })
    @IsString()
    note: string

    @IsNotEmpty()
    @ApiProperty({ example: 20 })
    @IsString()
    quantity: string

    @IsNotEmpty()
    @ApiProperty({ example: 'vien' })
    @IsString()
    unit: string
}