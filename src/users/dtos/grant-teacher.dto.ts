import { IsEmail, IsNotEmpty } from 'class-validator';

export class GrantTeacherDto {
    @IsEmail({}, { message: 'Невірний формат email' })
    @IsNotEmpty({ message: 'Email обов\'язковий' })
    email: string;
}
