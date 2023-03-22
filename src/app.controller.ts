import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';

import { LeadData } from './types';

@Controller(`api`)
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get(`leads`)
  async getLeads(@Query('query') query: string): Promise<LeadData[]> {
    return await this.appService.getLeads(query);
  }
}
