import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiCreateDocs, ApiDeleteDocs, ApiDocs, ApiIdParam } from '../../common/swagger/docs';
import { CurrentUserPayload } from '../../common/types/auth.types';
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
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.id, dto);
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
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(user.id, projectId, dto);
  }

  @Delete(':projectId')
  @ApiDeleteDocs('Delete a project.')
  @ApiIdParam('projectId', 'Project id.')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('projectId') projectId: string) {
    return this.projectsService.remove(user.id, projectId);
  }
}
