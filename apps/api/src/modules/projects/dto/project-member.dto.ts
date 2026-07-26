import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import { IsEmail, IsIn, IsOptional } from 'class-validator';

const ROLES = Object.values(ProjectRole);

export class AddProjectMemberDto {
  @ApiProperty({ example: 'teammate@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ enum: ROLES, default: 'VIEWER' })
  @IsOptional()
  @IsIn(ROLES)
  role?: ProjectRole;
}

export class UpdateProjectMemberDto {
  @ApiProperty({ enum: ROLES })
  @IsIn(ROLES)
  role!: ProjectRole;
}
