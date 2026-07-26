import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiCreateDocs, ApiDeleteDocs, ApiDocs, ApiIdParam } from '../../common/swagger/docs';
import { AuditActor } from '../../common/services/audit.service';
import { CurrentUserPayload } from '../../common/types/auth.types';
import { AddProjectMemberDto, UpdateProjectMemberDto } from './dto/project-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiCreateDocs('Create a project.')
  create(@CurrentActor() actor: AuditActor, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(actor, dto);
  }

  @Get()
  @ApiDocs('List projects owned by the current user.')
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.projectsService.findAll(user.id);
  }

  @Get(':projectId')
  @ApiDocs('Get one project by id.')
  @ApiIdParam('projectId', 'Project id.')
  findOne(@CurrentUser() user: CurrentUserPayload, @Param('projectId') projectId: string) {
    return this.projectsService.findOne(user.id, projectId);
  }

  @Patch(':projectId')
  @ApiDocs('Update a project.')
  @ApiIdParam('projectId', 'Project id.')
  update(
    @CurrentActor() actor: AuditActor,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(actor, projectId, dto);
  }

  @Delete(':projectId')
  @ApiDeleteDocs('Delete a project. Requires the owner role.')
  @ApiIdParam('projectId', 'Project id.')
  remove(@CurrentActor() actor: AuditActor, @Param('projectId') projectId: string) {
    return this.projectsService.remove(actor, projectId);
  }

  @Get(':projectId/members')
  @ApiDocs('List the members of a project.')
  @ApiIdParam('projectId', 'Project id.')
  findMembers(@CurrentUser() user: CurrentUserPayload, @Param('projectId') projectId: string) {
    return this.projectsService.findMembers(user.id, projectId);
  }

  @Post(':projectId/members')
  @ApiCreateDocs('Add a registered user to a project. Requires the admin role.')
  @ApiIdParam('projectId', 'Project id.')
  addMember(
    @CurrentActor() actor: AuditActor,
    @Param('projectId') projectId: string,
    @Body() dto: AddProjectMemberDto,
  ) {
    return this.projectsService.addMember(actor, projectId, dto);
  }

  @Patch('members/:memberId')
  @ApiDocs('Change a member role. Requires the admin role.')
  @ApiIdParam('memberId', 'Project member id.')
  updateMember(
    @CurrentActor() actor: AuditActor,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateProjectMemberDto,
  ) {
    return this.projectsService.updateMember(actor, memberId, dto);
  }

  @Delete('members/:memberId')
  @ApiDeleteDocs('Remove a member from a project. Requires the admin role.')
  @ApiIdParam('memberId', 'Project member id.')
  removeMember(@CurrentActor() actor: AuditActor, @Param('memberId') memberId: string) {
    return this.projectsService.removeMember(actor, memberId);
  }
}
