import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RequestPasswordResetDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token from the reset link.' })
  @IsString()
  @MinLength(10)
  @MaxLength(512)
  token!: string;

  @ApiProperty({ example: 'a-new-strong-password', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}
