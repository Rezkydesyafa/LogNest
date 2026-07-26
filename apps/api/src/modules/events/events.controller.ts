import { Controller, MessageEvent, Query, Sse, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { ProjectEvent, ProjectEventsService } from '../../../../../packages/shared/src';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProjectAccessService } from '../../common/services/project-access.service';
import { CurrentUserPayload } from '../../common/types/auth.types';

const HEARTBEAT_MS = 25_000;

@ApiTags('events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(
    private readonly events: ProjectEventsService,
    private readonly access: ProjectAccessService,
  ) {}

  /**
   * Live incident feed for one project, as Server-Sent Events.
   *
   * SSE rather than WebSockets: the traffic is one-directional, it survives the existing
   * HTTP proxy and Cloudflare tunnel unchanged, and the browser reconnects on its own.
   */
  @Sse('stream')
  @ApiOperation({ summary: 'Stream live incident events for a project (SSE).' })
  @ApiQuery({ name: 'projectId', required: true })
  stream(
    @CurrentUser() user: CurrentUserPayload,
    @Query('projectId') projectId: string,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      let unsubscribe: (() => void) | undefined;
      let closed = false;

      // Proxies drop an idle connection; a comment-only ping keeps it open.
      const heartbeat = setInterval(() => {
        subscriber.next({ type: 'ping', data: { at: new Date().toISOString() } });
      }, HEARTBEAT_MS);

      void (async () => {
        try {
          await this.access.assert(user.id, projectId);
        } catch (error) {
          subscriber.error(error);
          return;
        }

        if (closed) return;

        unsubscribe = await this.events.subscribe((event: ProjectEvent) => {
          if (event.projectId !== projectId) return;
          subscriber.next({ type: event.type, data: event });
        });

        subscriber.next({ type: 'ready', data: { projectId } });
      })();

      return () => {
        closed = true;
        clearInterval(heartbeat);
        unsubscribe?.();
      };
    });
  }
}
