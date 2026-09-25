import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchJobsDto } from './dto/search-jobs.dto.js';
import { JobsService } from './jobs.service.js';

@ApiTags('Public Jobs')
@Controller('public/jobs')
export class PublicJobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search public jobs' })
  searchPublicJobs(@Query() query: SearchJobsDto) {
    return this.jobsService.searchJobs(query, 'public');
  }

  @Get(':identifier')
  @ApiOperation({ summary: 'Fetch a public job by slug' })
  findPublicJobBySlug(@Param('identifier') identifier: string) {
    return this.jobsService.findPublicJobByIdentifier(identifier);
  }
}
