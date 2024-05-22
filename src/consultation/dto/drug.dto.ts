import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsDateString, IsEnum, IsNotEmpty, IsNumber, IsString, Matches, Max, Min } from "class-validator";

export class DrugDto {
    @IsNotEmpty()
    @ApiProperty({ example: 'paracetamol' })
    @IsString()
    name: string

    @IsNotEmpty()
    @ApiProperty({ example: 'VD-24086-16' })
    @IsString()
    code: string

    @IsNotEmpty()
    @ApiProperty({ example: 'Vien nen' })
    @IsString()
    type: string

    @ApiProperty({ example: 'uong sau khi an' })
    @IsString()
    note: string

    @IsNotEmpty()
    @ApiProperty({ example: 20 })
    @IsString()
    quantity: number
}