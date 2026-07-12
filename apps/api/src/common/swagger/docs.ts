import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

export function ApiDocs(summary: string, okDescription = 'Successful response') {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiOkResponse({ description: okDescription }),
    ApiBadRequestResponse({ description: 'Invalid request payload or query.' }),
    ApiUnauthorizedResponse({ description: 'Missing or invalid authentication.' }),
    ApiForbiddenResponse({ description: 'Authenticated caller cannot access this resource.' }),
    ApiNotFoundResponse({ description: 'Requested resource was not found.' }),
  );
}

export function ApiCreateDocs(summary: string, description = 'Resource created.') {
  return applyDecorators(ApiOperation({ summary }), ApiCreatedResponse({ description }));
}

export function ApiDeleteDocs(summary: string, description = 'Resource deleted or revoked.') {
  return applyDecorators(ApiOperation({ summary }), ApiNoContentResponse({ description }), ApiOkResponse({ description }));
}

export function ApiIdParam(name: string, description: string) {
  return ApiParam({ name, description, type: String });
}
